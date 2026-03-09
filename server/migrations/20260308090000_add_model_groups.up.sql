CREATE TABLE model_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    description TEXT DEFAULT '',
    sort_order INT NOT NULL DEFAULT 0,
    is_builtin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO model_groups (name, display_name, description, sort_order, is_builtin)
VALUES
    ('core_topology', '核心拓扑', '承载业务主线内置模型', 10, TRUE),
    ('resource_objects', '资源对象', '承载基础资源类模型', 20, TRUE),
    ('custom_models', '自定义模型', '承载租户扩展的自定义模型', 30, TRUE)
ON CONFLICT (name) DO NOTHING;

ALTER TABLE models
    ADD COLUMN group_id UUID REFERENCES model_groups(id);

CREATE INDEX idx_models_group_id ON models(group_id);

UPDATE models
SET group_id = (
    SELECT id FROM model_groups WHERE name = 'core_topology'
)
WHERE name IN ('business', 'set', 'module');

UPDATE models
SET group_id = (
    SELECT id FROM model_groups WHERE name = 'resource_objects'
)
WHERE name IN ('host');

UPDATE models
SET group_id = (
    SELECT id FROM model_groups WHERE name = 'custom_models'
)
WHERE group_id IS NULL;
