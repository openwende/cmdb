# 快速开始

[English](README.md) | 简体中文

用 Docker Compose 从源码运行 PostgreSQL、API 服务和 Web 界面。AI 助手是可选的。

## 启动

把 [cmdb-server](https://github.com/openwende/cmdb-server)、[cmdb-web](https://github.com/openwende/cmdb-web) 和 [cmdb-ai](https://github.com/openwende/cmdb-ai) 克隆到同一个目录下，然后运行：

```bash
cd cmdb-server/deploy/quickstart
./init-env.sh
docker compose up -d --build
```

`init-env.sh` 会生成带随机密钥的 `.env`，并打印管理员密码。首次构建需要几分钟，完成后打开 <http://localhost:3000>。

## 启用 AI 助手

AI 助手需要 [DeepSeek](https://platform.deepseek.com/) API Key，使用时会消耗你的 DeepSeek 额度。在 `.env` 里填好 `DEEPSEEK_API_KEY`，然后运行：

```bash
docker compose --profile ai up -d --build
```

知识库检索需要向量模型，默认关闭。启用方法见 [cmdb-ai 的 README](https://github.com/openwende/cmdb-ai/blob/main/README.zh-CN.md#知识库检索)。

## 选项

在 `.env` 中设置：

| 变量 | 默认值 | 说明 |
|---|---|---|
| `WEB_PORT` | `3000` | Web 界面的端口 |
| `GOPROXY` | `https://proxy.golang.org,direct` | 构建时使用的 Go 模块代理。国内网络可设为 `https://goproxy.cn,direct` |
| `CMDB_WEB_DIR` | `../../../cmdb-web` | cmdb-web 的路径 |
| `CMDB_AI_DIR` | `../../../cmdb-ai` | cmdb-ai 的路径 |

## 停止

```bash
docker compose --profile ai down      # 停止，保留数据
docker compose --profile ai down -v   # 停止并删除数据
```

## 用于生产环境

这套配置用于试用。暴露到网络之前，请放在终止 TLS 的反向代理之后，并在首次登录后修改管理员密码。
