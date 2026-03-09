DROP INDEX IF EXISTS idx_models_group_id;

ALTER TABLE models
    DROP COLUMN IF EXISTS group_id;

DROP TABLE IF EXISTS model_groups;
