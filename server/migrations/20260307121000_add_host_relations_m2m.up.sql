-- 主机多对多关系：host <-> business, host <-> module

CREATE TABLE IF NOT EXISTS host_business_relations (
    host_id UUID NOT NULL,
    business_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (host_id, business_id),
    CONSTRAINT fk_host_business_relations_host
        FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE,
    CONSTRAINT fk_host_business_relations_business
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS host_module_relations (
    host_id UUID NOT NULL,
    module_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (host_id, module_id),
    CONSTRAINT fk_host_module_relations_host
        FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_host_business_relations_business_id
    ON host_business_relations (business_id);
CREATE INDEX IF NOT EXISTS idx_host_module_relations_module_id
    ON host_module_relations (module_id);

-- 旧单归属字段回填到新关系表（幂等）
INSERT INTO host_business_relations (host_id, business_id)
SELECT h.id, b.id
FROM hosts h
JOIN businesses b ON b.business_id = h.business_id
WHERE h.business_id IS NOT NULL
ON CONFLICT (host_id, business_id) DO NOTHING;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hosts' AND column_name = 'module_id'
    ) THEN
        INSERT INTO host_module_relations (host_id, module_id)
        SELECT h.id, h.module_id
        FROM hosts h
        WHERE h.module_id IS NOT NULL
        ON CONFLICT (host_id, module_id) DO NOTHING;
    END IF;
END $$;
