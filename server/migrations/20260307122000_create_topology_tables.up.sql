-- 拓扑基础表：sets / modules

CREATE TABLE IF NOT EXISTS sets (
    id BIGSERIAL PRIMARY KEY,
    business_id UUID NOT NULL,
    name VARCHAR(200) NOT NULL,
    description VARCHAR(500),
    env_type VARCHAR(50),
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT fk_sets_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS modules (
    id BIGSERIAL PRIMARY KEY,
    set_id BIGINT NOT NULL,
    business_id UUID NOT NULL,
    service_template_id BIGINT,
    name VARCHAR(200) NOT NULL,
    description VARCHAR(500),
    service_type VARCHAR(50),
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT fk_modules_set FOREIGN KEY (set_id) REFERENCES sets(id) ON DELETE CASCADE,
    CONSTRAINT fk_modules_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sets_business_id ON sets (business_id);
CREATE INDEX IF NOT EXISTS idx_sets_is_default ON sets (business_id, is_default) WHERE is_default = TRUE;
CREATE INDEX IF NOT EXISTS idx_modules_set_id ON modules (set_id);
CREATE INDEX IF NOT EXISTS idx_modules_business_id ON modules (business_id);
CREATE INDEX IF NOT EXISTS idx_modules_is_default ON modules (set_id, is_default) WHERE is_default = TRUE;
