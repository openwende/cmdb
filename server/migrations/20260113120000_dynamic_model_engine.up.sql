-- Enable ltree extension for topology paths
CREATE EXTENSION IF NOT EXISTS ltree;

-- ==========================================
-- 1. Meta-Model Layer (Definitions)
-- ==========================================

-- Models Table: Defines the types of objects (e.g., Host, Module, Cluster)
CREATE TABLE models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,      -- machine-readable name (e.g., 'host')
    display_name VARCHAR(200) NOT NULL,     -- human-readable name (e.g., '主机')
    classification VARCHAR(50) NOT NULL,    -- category (e.g., 'resource', 'business')
    icon VARCHAR(100),
    is_builtin BOOLEAN DEFAULT FALSE,       -- system models cannot be deleted
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Model Attributes: Defines the schema for each model (e.g., 'ip', 'hostname')
CREATE TABLE model_attributes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID REFERENCES models(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    field_type VARCHAR(50) NOT NULL,        -- string, int, float, bool, datetime, enum, json, user, obj_ref
    is_required BOOLEAN DEFAULT FALSE,
    is_unique BOOLEAN DEFAULT FALSE,
    is_editable BOOLEAN DEFAULT TRUE,
    is_system BOOLEAN DEFAULT FALSE,        -- system attributes cannot be deleted
    options JSONB DEFAULT '{}',             -- validation rules, default values, enum options
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(model_id, name)
);

-- Model Relations: Defines valid relationships between models (e.g., Host belongs to Module)
CREATE TABLE model_relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_model_id UUID REFERENCES models(id) ON DELETE CASCADE,
    target_model_id UUID REFERENCES models(id) ON DELETE CASCADE,
    relation_type VARCHAR(50) NOT NULL,     -- composition, association
    mapping_type VARCHAR(50) NOT NULL DEFAULT '1:n', 
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source_model_id, target_model_id, relation_type)
);

-- ==========================================
-- 2. Instance Storage Layer (Data)
-- ==========================================

-- Unified Instance Table (Partitioned by Model ID)
-- This table stores ALL object instances. It uses partitioning to improve performance.
CREATE TABLE model_instances (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    business_id UUID,                       -- Optimization for business-scoping
    
    properties JSONB NOT NULL DEFAULT '{}', -- All dynamic fields go here
    path ltree,                             -- Topology path (e.g., bizID.clusterID.moduleID.hostID)
    
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    -- Partition key MUST be part of the primary key
    PRIMARY KEY (id, model_id)
) PARTITION BY LIST (model_id);

-- Indexes for Generic Instance Table
CREATE INDEX idx_model_instances_properties_gin ON model_instances USING GIN (properties);
CREATE INDEX idx_model_instances_path_gist ON model_instances USING GIST (path);
CREATE INDEX idx_model_instances_tenant ON model_instances (tenant_id);
CREATE INDEX idx_model_instances_business ON model_instances (business_id);
CREATE INDEX idx_model_instances_deleted ON model_instances (deleted_at) WHERE deleted_at IS NULL;

-- Instance Relations: Links specific instances (e.g., Host A -> Module B)
CREATE TABLE instance_relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_instance_id UUID NOT NULL,
    target_instance_id UUID NOT NULL,
    source_model_id UUID NOT NULL,          -- Stored for potential partitioning alignment or quick lookup
    target_model_id UUID NOT NULL,
    relation_id UUID REFERENCES model_relations(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_instance_relations_source ON instance_relations (source_instance_id);
CREATE INDEX idx_instance_relations_target ON instance_relations (target_instance_id);
