#!/usr/bin/env sh
# 生成本地 Langfuse 的 .env：所有密钥随机生成，不在终端打印；.env 已被 .gitignore 忽略。
# 已存在时不覆盖（覆盖会让已有数据库的密码对不上）。
set -eu
cd "$(dirname "$0")"
if [ -f .env ]; then
  echo ".env 已存在，不覆盖"
  exit 0
fi
hex() { openssl rand -hex "$1"; }
umask 077
cat > .env <<EOF
POSTGRES_PASSWORD=$(hex 16)
CLICKHOUSE_PASSWORD=$(hex 16)
MINIO_ROOT_PASSWORD=$(hex 16)
REDIS_AUTH=$(hex 16)
SALT=$(hex 16)
ENCRYPTION_KEY=$(hex 32)
NEXTAUTH_SECRET=$(hex 32)
LANGFUSE_INIT_PROJECT_PUBLIC_KEY=pk-lf-$(hex 16)
LANGFUSE_INIT_PROJECT_SECRET_KEY=sk-lf-$(hex 16)
LANGFUSE_INIT_USER_EMAIL=admin@wende.local
LANGFUSE_INIT_USER_PASSWORD=$(hex 12)
EOF
echo "已生成 $(pwd)/.env"
