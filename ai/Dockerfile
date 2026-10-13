# AI 服务镜像（本机用，见 docker-compose.yml）。
#
# - 两个本地模型（bge-m3、bge-reranker-v2-m3，约 4.2GB）不打进镜像，运行时只读挂载宿主机的
#   Hugging Face 缓存，并设 HF_HUB_OFFLINE=1
# - 本机是 Apple Silicon，镜像是 linux/arm64：PyPI 的 aarch64 torch 本来就只有 CPU 版，
#   不带 CUDA 依赖，所以沿用 uv.lock，不另配 PyTorch CPU 源。容器里没有 MPS，推理走 CPU
FROM ghcr.io/astral-sh/uv:0.9.4 AS uv

FROM python:3.12.13-slim-trixie

COPY --from=uv /uv /usr/local/bin/uv

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/app/.venv

WORKDIR /app

# 先只装依赖：源码改动不会让 torch 那一层重新安装
COPY pyproject.toml uv.lock .python-version ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project

COPY src ./src
COPY knowledge ./knowledge
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

RUN useradd --create-home --uid 10001 app
USER app

ENV PATH="/app/.venv/bin:$PATH" \
    HF_HOME=/models/huggingface \
    HF_HUB_OFFLINE=1

EXPOSE 8090
CMD ["uvicorn", "cmdb_ai.api:app", "--host", "0.0.0.0", "--port", "8090"]
