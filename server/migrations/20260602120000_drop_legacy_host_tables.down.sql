-- 回滚：重建旧三表结构（仅结构，历史数据不恢复——退役后真相在 host_node_memberships）。
CREATE TABLE IF NOT EXISTS host_business_relations (
    host_id     UUID NOT NULL,
    business_id BIGINT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (host_id, business_id),
    CONSTRAINT fk_hbr_host FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE,
    CONSTRAINT fk_hbr_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_host_business_relations_business_id ON host_business_relations (business_id);

CREATE TABLE IF NOT EXISTS host_module_relations (
    host_id    UUID NOT NULL,
    module_id  BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (host_id, module_id),
    CONSTRAINT fk_hmr_host FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_host_module_relations_module_id ON host_module_relations (module_id);

CREATE TABLE IF NOT EXISTS resource_pool_hosts (
    host_id      UUID PRIMARY KEY,
    directory_id BIGINT NOT NULL,
    imported_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    imported_by  VARCHAR(100),
    remark       VARCHAR(500)
);
CREATE INDEX IF NOT EXISTS idx_resource_pool_hosts_directory_id ON resource_pool_hosts (directory_id);
