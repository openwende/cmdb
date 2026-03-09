CREATE TABLE IF NOT EXISTS platform_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description VARCHAR(500),
    updated_by VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO platform_settings (key, value, description)
VALUES
    ('topology.max_level', '{"value": 10}'::jsonb, '业务拓扑最大层级'),
    ('topology.idle_set_name', '{"value": "空闲机"}'::jsonb, '业务空闲机集群名'),
    ('topology.idle_module_name', '{"value": "空闲模块"}'::jsonb, '业务空闲模块名')
ON CONFLICT (key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_mainline_instances_business_parent_sort
    ON mainline_instances (business_id, parent_id, sort_order, id)
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mainline_instances_business_model_ref
    ON mainline_instances (business_id, model_name, ref_id)
    WHERE deleted_at IS NULL;
