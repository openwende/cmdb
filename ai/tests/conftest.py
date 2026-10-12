import hashlib

import psycopg
import pytest

from cmdb_ai.config import get_settings
from cmdb_ai.knowledge_store import EMBED_DIM, setup


class FakeEmbedder:
    """按文本哈希生成确定的向量，记录每次向量化了哪些文本。"""

    name = "fake"

    def __init__(self):
        self.calls: list[list[str]] = []

    def embed(self, texts):
        self.calls.append(list(texts))
        out = []
        for t in texts:
            seed = hashlib.sha256(t.encode()).digest()
            out.append([seed[i % len(seed)] / 255 for i in range(EMBED_DIM)])
        return out


@pytest.fixture
def embedder() -> FakeEmbedder:
    return FakeEmbedder()


@pytest.fixture
def conn():
    """连本地库，在 AI 服务自己的 schema 里用一张临时测试表；连不上就跳过。"""
    settings = get_settings()
    try:
        connection = psycopg.connect(settings.database_url, connect_timeout=2)
    except psycopg.OperationalError:
        pytest.skip("本地数据库不可用")
    table = "knowledge_chunks_pytest"
    with connection:
        setup(connection, settings.ai_db_schema, table)
        yield connection, settings.ai_db_schema, table
        connection.rollback()
        connection.execute(f'DROP TABLE IF EXISTS "{settings.ai_db_schema}"."{table}"')
        connection.commit()
