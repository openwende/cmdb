CREATE TABLE IF NOT EXISTS business_custom_field_groups (
    id BIGSERIAL PRIMARY KEY,
    business_id UUID NOT NULL,
    object_type VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    collapsed_by_default BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INT NOT NULL DEFAULT 0,
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

ALTER TABLE business_custom_field_groups
    DROP CONSTRAINT IF EXISTS chk_business_custom_field_groups_object_type;
ALTER TABLE business_custom_field_groups
    ADD CONSTRAINT chk_business_custom_field_groups_object_type
    CHECK (object_type IN ('set', 'module', 'host'));

CREATE UNIQUE INDEX IF NOT EXISTS uk_business_custom_field_groups_name_active
ON business_custom_field_groups (business_id, object_type, name)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_business_custom_field_groups_business_object
ON business_custom_field_groups (business_id, object_type, sort_order)
WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS business_custom_fields (
    id BIGSERIAL PRIMARY KEY,
    business_id UUID NOT NULL,
    object_type VARCHAR(20) NOT NULL,
    group_id BIGINT REFERENCES business_custom_field_groups(id) ON DELETE SET NULL,
    field_uid VARCHAR(50) NOT NULL,
    field_name VARCHAR(100) NOT NULL,
    field_type VARCHAR(20) NOT NULL,
    is_required BOOLEAN NOT NULL DEFAULT FALSE,
    is_editable BOOLEAN NOT NULL DEFAULT TRUE,
    is_unique BOOLEAN NOT NULL DEFAULT FALSE,
    default_value VARCHAR(500),
    placeholder VARCHAR(200),
    validators JSONB NOT NULL DEFAULT '{}'::jsonb,
    options JSONB NOT NULL DEFAULT '{}'::jsonb,
    sort_order INT NOT NULL DEFAULT 0,
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

ALTER TABLE business_custom_fields
    DROP CONSTRAINT IF EXISTS chk_business_custom_fields_object_type;
ALTER TABLE business_custom_fields
    ADD CONSTRAINT chk_business_custom_fields_object_type
    CHECK (object_type IN ('set', 'module', 'host'));

CREATE UNIQUE INDEX IF NOT EXISTS uk_business_custom_fields_uid_active
ON business_custom_fields (business_id, object_type, field_uid)
WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uk_business_custom_fields_name_active
ON business_custom_fields (business_id, object_type, field_name)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_business_custom_fields_business_object_group
ON business_custom_fields (business_id, object_type, group_id, sort_order)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_business_custom_fields_validators_gin
ON business_custom_fields USING GIN (validators);

CREATE INDEX IF NOT EXISTS idx_business_custom_fields_options_gin
ON business_custom_fields USING GIN (options);
