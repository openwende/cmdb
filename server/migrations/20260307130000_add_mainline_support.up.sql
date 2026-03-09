ALTER TABLE models
    ADD COLUMN IF NOT EXISTS is_mainline BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS mainline_scope VARCHAR(20) NOT NULL DEFAULT 'none',
    ADD COLUMN IF NOT EXISTS mainline_level INTEGER,
    ADD COLUMN IF NOT EXISTS is_topology_builtin BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS mainline_parent_model_id UUID REFERENCES models(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_models_is_mainline ON models (is_mainline) WHERE is_mainline = TRUE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_models_mainline_level
    ON models (mainline_level)
    WHERE is_mainline = TRUE AND mainline_level IS NOT NULL;

CREATE TABLE IF NOT EXISTS mainline_instances (
    id BIGSERIAL PRIMARY KEY,
    model_name VARCHAR(100) NOT NULL,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    parent_id BIGINT REFERENCES mainline_instances(id) ON DELETE CASCADE,
    ref_id VARCHAR(100) NOT NULL,
    name VARCHAR(200) NOT NULL,
    path LTREE NOT NULL,
    level INTEGER NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    extra JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mainline_instances_model_ref
    ON mainline_instances (model_name, ref_id)
    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_mainline_instances_business_id
    ON mainline_instances (business_id)
    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_mainline_instances_parent_id
    ON mainline_instances (parent_id)
    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_mainline_instances_path_gist
    ON mainline_instances USING GIST (path);

INSERT INTO models (name, display_name, classification, icon, is_builtin, is_mainline, mainline_scope, mainline_level, is_topology_builtin, description)
VALUES
    ('business', '业务', 'business', 'business', TRUE, TRUE, 'global', 0, TRUE, '系统内置业务主线模型'),
    ('set', '集群', 'business', 'cluster', TRUE, TRUE, 'business', 1, TRUE, '系统内置集群主线模型'),
    ('module', '模块', 'business', 'module', TRUE, TRUE, 'business', 2, TRUE, '系统内置模块主线模型'),
    ('host', '主机', 'resource', 'host', TRUE, FALSE, 'none', NULL, TRUE, '系统内置主机模型')
ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    classification = EXCLUDED.classification,
    icon = EXCLUDED.icon,
    is_builtin = EXCLUDED.is_builtin,
    is_mainline = EXCLUDED.is_mainline,
    mainline_scope = EXCLUDED.mainline_scope,
    mainline_level = EXCLUDED.mainline_level,
    is_topology_builtin = EXCLUDED.is_topology_builtin,
    description = EXCLUDED.description,
    updated_at = NOW();

UPDATE models AS child
SET mainline_parent_model_id = parent.id,
    updated_at = NOW()
FROM models AS parent
WHERE child.name = 'set' AND parent.name = 'business';

UPDATE models AS child
SET mainline_parent_model_id = parent.id,
    updated_at = NOW()
FROM models AS parent
WHERE child.name = 'module' AND parent.name = 'set';
