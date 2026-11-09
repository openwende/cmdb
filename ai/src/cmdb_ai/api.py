"""FastAPI 应用：对话（SSE）、历史会话、知识库小节、健康检查。

POST   /chat                              SSE 流式对话；同一会话上一条没答完时 409，
                                          今天的提问次数用完时 429
GET    /conversations                     当前用户的会话列表
GET    /conversations/{id}/messages       恢复一个会话的问答
DELETE /conversations/{id}                删除会话（连同检查点）
GET    /knowledge/sections?id=文档#小节    知识库小节原文（前端点开 [doc=…] 引用）
GET    /health
"""

import asyncio
import json
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Path, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from sse_starlette import EventSourceResponse

from cmdb_ai.checkpoint import open_checkpointer, open_pool
from cmdb_ai.cmdb import CMDBAuthError, CMDBClient, UserContext
from cmdb_ai.config import get_settings
from cmdb_ai.conversations import ConversationStore
from cmdb_ai.investigator import Investigator, thread_id_for
from cmdb_ai.quota import QuotaStore, today

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

CONVERSATION_ID = r"^[A-Za-z0-9_-]+$"
BUSY_MESSAGE = "上一条消息还在处理中，请等它完成或先停止"


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    cmdb = CMDBClient(settings.cmdb_base_url, settings.cmdb_timeout_seconds)
    async with open_pool(settings.database_url, settings.ai_db_schema) as pool:
        checkpointer = await open_checkpointer(pool)
        store = ConversationStore(pool, settings.ai_db_schema)
        await store.setup()
        quota = QuotaStore(pool, settings.ai_db_schema)
        await quota.setup()
        app.state.cmdb = cmdb
        app.state.store = store
        app.state.quota = quota
        app.state.investigator = Investigator(settings, checkpointer)
        app.state.active_threads = set()
        # 知识库用本地模型时约 4GB，启动时加载好，第一个问题不用多等十几秒
        if app.state.investigator.knowledge.enabled:
            await asyncio.to_thread(app.state.investigator.knowledge.warm_up)
        try:
            yield
        finally:
            await cmdb.aclose()
            app.state.investigator.tracing.shutdown()  # 把还没发出的 trace 发完


app = FastAPI(title="wende-cmdb-ai", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
bearer = HTTPBearer(auto_error=False)


async def current_user(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> UserContext:
    if credentials is None:
        raise HTTPException(status_code=401, detail="缺少登录凭证")
    try:
        return await request.app.state.cmdb.whoami(credentials.credentials)
    except CMDBAuthError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc


User = Annotated[UserContext, Depends(current_user)]
ConversationId = Annotated[str, Path(min_length=1, max_length=128, pattern=CONVERSATION_ID)]


class ChatRequest(BaseModel):
    conversation_id: str = Field(min_length=1, max_length=128, pattern=CONVERSATION_ID)
    message: str = Field(min_length=1, max_length=4000)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/chat")
async def chat(body: ChatRequest, request: Request, user: User) -> EventSourceResponse:
    state = request.app.state
    investigator: Investigator = state.investigator
    store: ConversationStore = state.store
    active: set[str] = state.active_threads
    thread_id = thread_id_for(user, body.conversation_id)
    if thread_id in active:
        # 同一会话并发跑两轮会读写同一份检查点，后完成的会覆盖先完成的
        raise HTTPException(status_code=409, detail=BUSY_MESSAGE)
    settings = get_settings()
    exceeded = await state.quota.consume(
        user.user_id,
        today(settings.quota_timezone),
        settings.chat_daily_limit_per_user,
        settings.chat_daily_limit_total,
    )
    if exceeded is not None:
        logger.warning("提问次数已用完 scope=%s user=%s", exceeded.scope, user.username)
        raise HTTPException(status_code=429, detail=exceeded.message)

    def sse(event: str, data: dict) -> dict[str, str]:
        return {"event": event, "data": json.dumps(data, ensure_ascii=False, default=str)}

    async def events() -> AsyncIterator[dict[str, str]]:
        # 上面的检查和这里的登记之间有 await，两个几乎同时到的请求可能都通过检查；
        # 这里检查和登记之间没有 await，是原子的
        if thread_id in active:
            yield sse("error", {"message": BUSY_MESSAGE})
            return
        active.add(thread_id)
        try:
            await store.add_message(user.user_id, body.conversation_id, "user", body.message)
            async for event in investigator.stream(body.conversation_id, body.message, user):
                if event.event == "final":
                    await store.add_message(
                        user.user_id, body.conversation_id, "assistant", event.data["answer"]
                    )
                yield sse(event.event, event.data)
        finally:
            # 客户端断开时生成器被取消，也会走到这里
            active.discard(thread_id)

    return EventSourceResponse(events())


@app.get("/conversations")
async def list_conversations(request: Request, user: User) -> dict:
    return {"items": await request.app.state.store.list_conversations(user.user_id)}


@app.get("/conversations/{conversation_id}/messages")
async def conversation_messages(
    conversation_id: ConversationId, request: Request, user: User
) -> dict:
    items = await request.app.state.store.messages(user.user_id, conversation_id)
    if items is None:
        raise HTTPException(status_code=404, detail="会话不存在")
    return {"items": items}


@app.delete("/conversations/{conversation_id}", status_code=204)
async def delete_conversation(
    conversation_id: ConversationId, request: Request, user: User
) -> Response:
    if thread_id_for(user, conversation_id) in request.app.state.active_threads:
        raise HTTPException(status_code=409, detail=BUSY_MESSAGE)
    if not await request.app.state.store.delete(user.user_id, conversation_id):
        raise HTTPException(status_code=404, detail="会话不存在")
    await request.app.state.investigator.delete_thread(user, conversation_id)
    return Response(status_code=204)


@app.get("/knowledge/sections")
async def knowledge_section(
    request: Request, user: User, id: Annotated[str, Query(min_length=1, max_length=200)]
) -> dict:
    # 知识库关闭的部署里没有建知识库表
    knowledge_enabled = request.app.state.investigator.knowledge.enabled
    section = await request.app.state.store.knowledge_section(id) if knowledge_enabled else None
    if section is None:
        raise HTTPException(status_code=404, detail="知识库小节不存在")
    return section
