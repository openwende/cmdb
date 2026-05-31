-- 主机归属统一关系表（P1 真相收敛，见 docs/P1-host-membership-convergence.md）
-- 收敛 host_module_relations + host_business_relations + resource_pool_hosts 三表为单一多对多关系表。
-- 阶段 0：仅建表 + 回填，不接入写路径（双写在阶段 1）。
CREATE TABLE IF NOT EXISTS host_node_memberships (
    id            BIGSERIAL   PRIMARY KEY,
    host_id       UUID        NOT NULL,
    node_kind     VARCHAR(20) NOT NULL,                       -- 'pool_directory' | 'biz_module'
    node_id       BIGINT      NOT NULL,                       -- → resource_directories.id 或 modules.id
    business_id   BIGINT,                                     -- 冗余维度：biz_module 时所属业务；pool_directory 时为 NULL
    set_id        BIGINT,                                     -- 冗余维度：biz_module 时所属集群
    relation_type VARCHAR(50) NOT NULL DEFAULT 'member_of',
    source        VARCHAR(30),                                -- import|allocate|transfer|reclaim|recycle
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by    VARCHAR(100),
    CONSTRAINT uq_hnm_host_node UNIQUE (host_id, node_kind, node_id, relation_type),
    CONSTRAINT fk_hnm_host FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_hnm_host ON host_node_memberships (host_id);
CREATE INDEX IF NOT EXISTS idx_hnm_node ON host_node_memberships (node_kind, node_id);
CREATE INDEX IF NOT EXISTS idx_hnm_biz  ON host_node_memberships (business_id);
