CREATE TABLE IF NOT EXISTS businesses (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    updated_by UUID,
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    identifier TEXT NOT NULL,
    description TEXT,
    lifecycle TEXT NOT NULL DEFAULT 'online',
    timezone TEXT NOT NULL DEFAULT 'UTC',
    language TEXT NOT NULL DEFAULT 'en',
    maintainers UUID[] DEFAULT '{}',
    is_built_in BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE UNIQUE INDEX idx_businesses_identifier_tenant ON businesses (identifier, tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_businesses_tenant_id ON businesses (tenant_id);

CREATE TABLE IF NOT EXISTS business_personnel (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    user_id UUID,
    identity TEXT NOT NULL,
    role TEXT NOT NULL
);

CREATE INDEX idx_business_personnel_business_id ON business_personnel (business_id);
CREATE INDEX idx_business_personnel_role ON business_personnel (role);

CREATE TABLE IF NOT EXISTS business_sets (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    updated_by UUID,
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    identifier TEXT NOT NULL,
    description TEXT,
    scope TEXT, -- JSONB stored as text for now, or use JSONB
    maintainers UUID[] DEFAULT '{}'
);

CREATE UNIQUE INDEX idx_business_sets_identifier_tenant ON business_sets (identifier, tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_business_sets_tenant_id ON business_sets (tenant_id);

CREATE TABLE IF NOT EXISTS business_set_members (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    business_set_id UUID NOT NULL REFERENCES business_sets(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    CONSTRAINT uniq_business_set_member UNIQUE (business_set_id, business_id)
);

CREATE INDEX idx_business_set_members_business_set_id ON business_set_members (business_set_id);
CREATE INDEX idx_business_set_members_business_id ON business_set_members (business_id);
