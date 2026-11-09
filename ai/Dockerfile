# AI 服务镜像。
#
# - 默认不装本地知识库模型的依赖（torch、sentence-transformers、transformers）：本机和 207 都用托管 API
#   （KNOWLEDGE_MODEL_PROVIDER=siliconflow）。要用本地模型时构建加 --build-arg INSTALL_LOCAL_MODELS=true
#   （linux 的 torch 从 PyTorch CPU 源装，见 pyproject.toml 的 [tool.uv.sources]）
# - 两个本地模型（bge-m3、bge-reranker-v2-m3，约 4.2GB）不打进镜像，运行时只读挂载宿主机的
#   Hugging Face 缓存，并设 HF_HUB_OFFLINE=1。容器里没有 MPS，推理走 CPU
FROM ghcr.io/astral-sh/uv:0.9.4 AS uv

FROM python:3.15.0-slim-trixie

COPY --from=uv /uv /usr/local/bin/uv

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/app/.venv

WORKDIR /app

ARG INSTALL_LOCAL_MODELS=false

# 先只装依赖：源码改动不会让依赖那一层重新安装
COPY pyproject.toml uv.lock .python-version ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project \
        $([ "$INSTALL_LOCAL_MODELS" = true ] && echo --extra local-models)

COPY src ./src
COPY knowledge ./knowledge
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev \
        $([ "$INSTALL_LOCAL_MODELS" = true ] && echo --extra local-models)

RUN useradd --create-home --uid 10001 app
USER app

ENV PATH="/app/.venv/bin:$PATH" \
    HF_HOME=/models/huggingface \
    HF_HUB_OFFLINE=1

EXPOSE 8090
CMD ["uvicorn", "cmdb_ai.api:app", "--host", "0.0.0.0", "--port", "8090"]
