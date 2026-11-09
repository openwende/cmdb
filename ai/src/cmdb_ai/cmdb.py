"""Go CMDB 后端的 HTTP 客户端：登录、校验用户身份。"""

from dataclasses import dataclass

import httpx


class CMDBAuthError(Exception):
    """JWT 无效或已过期。"""


@dataclass(frozen=True)
class UserContext:
    """一次调用的用户身份，通过 create_agent 的 context 传入。

    只在运行时存在，不进入消息状态，因此不会被写进检查点表。
    """

    user_id: str
    username: str
    jwt: str

    def __repr__(self) -> str:  # 避免 JWT 出现在日志和异常信息里
        return f"UserContext(user_id={self.user_id!r}, username={self.username!r})"


class CMDBClient:
    def __init__(self, base_url: str, timeout: float = 30.0):
        self._http = httpx.AsyncClient(base_url=base_url, timeout=timeout)

    async def aclose(self) -> None:
        await self._http.aclose()

    async def login(self, username: str, password: str) -> str:
        resp = await self._http.post(
            "/api/v1/auth/login", json={"username": username, "password": password}
        )
        if resp.status_code == 401:
            raise CMDBAuthError("用户名或密码错误")
        resp.raise_for_status()
        return resp.json()["access_token"]

    async def whoami(self, jwt: str) -> UserContext:
        """用 /auth/me 校验 JWT，返回用户身份。"""
        resp = await self._http.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {jwt}"})
        if resp.status_code == 401:
            raise CMDBAuthError("登录已失效，请重新登录")
        resp.raise_for_status()
        profile = resp.json()
        return UserContext(user_id=str(profile["id"]), username=profile["username"], jwt=jwt)
