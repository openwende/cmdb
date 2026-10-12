"""FastAPI 应用：POST /chat（SSE 流式对话）、GET /health。"""

import asyncio
import json
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from sse_starlette import EventSourceResponse

from cmdb_ai.checkpoint import open_checkpointer
from cmdb_ai.cmdb import CMDBAuthError, CMDBClient, UserContext
from cmdb_ai.config import get_settings
from cmdb_ai.investigator import Investigator

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    cmdb = CMDBClient(settings.cmdb_base_url, settings.cmdb_timeout_seconds)
    async with open_checkpointer(settings.database_url, settings.ai_db_schema) as checkpointer:
        app.state.cmdb = cmdb
        app.state.investigator = Investigator(settings, checkpointer)
        # 知识库的两个本地模型约 4GB，启动时加载好，第一个问题不用多等十几秒
        await asyncio.to_thread(app.state.investigator.knowledge.warm_up)
        try:
            yield
        finally:
            await cmdb.aclose()
            app.state.investigator.tracing.shutdown()  # 把还没发出的 trace 发完


app = FastAPI(title="wende-cmdb-ai", lifespan=lifespan)
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


class ChatRequest(BaseModel):
    conversation_id: str = Field(min_length=1, max_length=128, pattern=r"^[A-Za-z0-9_-]+$")
    message: str = Field(min_length=1, max_length=4000)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/chat")
async def chat(
    body: ChatRequest,
    request: Request,
    user: Annotated[UserContext, Depends(current_user)],
) -> EventSourceResponse:
    investigator: Investigator = request.app.state.investigator

    async def events() -> AsyncIterator[dict[str, str]]:
        async for sse in investigator.stream(body.conversation_id, body.message, user):
            yield {
                "event": sse.event,
                "data": json.dumps(sse.data, ensure_ascii=False, default=str),
            }

    return EventSourceResponse(events())
