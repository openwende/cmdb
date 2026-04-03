CREATE TABLE IF NOT EXISTS model_unique_rules (
    id BIGSERIAL PRIMARY KEY,
    model_uid VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_auxiliary BOOLEAN NOT NULL DEFAULT FALSE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ignore_if_all_empty BOOLEAN NOT NULL DEFAULT TRUE,
    description VARCHAR(500),
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS model_unique_rule_fields (
    id BIGSERIAL PRIMARY KEY,
    rule_id BIGINT NOT NULL REFERENCES model_unique_rules(id) ON DELETE CASCADE,
    field_uid VARCHAR(50) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_model_unique_rules_default_active
ON model_unique_rules (model_uid, is_default)
WHERE is_default = TRUE AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uk_model_unique_rules_name_active
ON model_unique_rules (model_uid, name)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_model_unique_rules_model
ON model_unique_rules (model_uid, enabled)
WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uk_model_unique_rule_fields
ON model_unique_rule_fields (rule_id, field_uid);

CREATE INDEX IF NOT EXISTS idx_model_unique_rule_fields_rule_sort
ON model_unique_rule_fields (rule_id, sort_order);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'dynamic_models'
          AND column_name = 'unique_fields'
    ) THEN
        INSERT INTO model_unique_rules (
            model_uid,
            name,
            is_default,
            is_auxiliary,
            enabled,
            ignore_if_all_empty,
            description
        )
        SELECT
            uid,
            COALESCE(NULLIF(unique_fields->>'name', ''), uid || '_legacy_unique'),
            TRUE,
            FALSE,
            TRUE,
            TRUE,
            'legacy unique_fields backfill'
        FROM dynamic_models
        WHERE unique_fields IS NOT NULL
          AND unique_fields <> '{}'::jsonb
          AND jsonb_typeof(unique_fields->'fields') = 'array'
          AND jsonb_array_length(unique_fields->'fields') > 0
        ON CONFLICT DO NOTHING;

        INSERT INTO model_unique_rule_fields (rule_id, field_uid, sort_order)
        SELECT
            mur.id,
            field_uid.value,
            field_uid.ordinality - 1
        FROM model_unique_rules mur
        JOIN dynamic_models dm ON dm.uid = mur.model_uid
        JOIN LATERAL jsonb_array_elements_text(dm.unique_fields->'fields') WITH ORDINALITY AS field_uid(value, ordinality) ON TRUE
        WHERE mur.description = 'legacy unique_fields backfill'
        ON CONFLICT DO NOTHING;
    END IF;
END $$;
