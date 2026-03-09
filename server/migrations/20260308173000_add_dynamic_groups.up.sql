CREATE TABLE IF NOT EXISTS dynamic_groups (
    id UUID PRIMARY KEY,
    business_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    target_model_uid VARCHAR(50) NOT NULL,
    condition JSONB NOT NULL DEFAULT '[]'::jsonb,
    variable_condition JSONB NOT NULL DEFAULT '[]'::jsonb,
    last_preview_count INT NOT NULL DEFAULT 0,
    description VARCHAR(500),
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_dynamic_groups_biz_name_active
ON dynamic_groups (business_id, name)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_dynamic_groups_business_target
ON dynamic_groups (business_id, target_model_uid)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_dynamic_groups_condition_gin
ON dynamic_groups USING GIN (condition);

CREATE INDEX IF NOT EXISTS idx_dynamic_groups_variable_condition_gin
ON dynamic_groups USING GIN (variable_condition);
