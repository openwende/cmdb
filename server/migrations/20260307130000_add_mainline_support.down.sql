DROP TABLE IF EXISTS mainline_instances;

DROP INDEX IF EXISTS idx_models_mainline_level;
DROP INDEX IF EXISTS idx_models_is_mainline;

ALTER TABLE models
    DROP COLUMN IF EXISTS mainline_parent_model_id,
    DROP COLUMN IF EXISTS is_topology_builtin,
    DROP COLUMN IF EXISTS mainline_level,
    DROP COLUMN IF EXISTS mainline_scope,
    DROP COLUMN IF EXISTS is_mainline;
