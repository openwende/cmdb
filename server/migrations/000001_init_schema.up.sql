-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended');
CREATE TYPE model_status AS ENUM ('active', 'inactive', 'archived');
CREATE TYPE instance_status AS ENUM ('active', 'inactive', 'deleted');
CREATE TYPE audit_action AS ENUM ('create', 'update', 'delete', 'read');
CREATE TYPE event_type AS ENUM ('create', 'update', 'delete', 'custom');
CREATE TYPE event_status AS ENUM ('pending', 'processing', 'delivered', 'failed');
CREATE TYPE field_type AS ENUM ('string', 'longtext', 'int', 'float', 'bool', 'date', 'datetime', 'enum', 'multi_enum', 'user', 'timezone', 'list', 'table');
CREATE TYPE relation_type AS ENUM ('belongs_to', 'composed_of', 'running', 'uplink', 'default', 'custom');
CREATE TYPE constraint_type AS ENUM ('1:1', '1:N', 'N:N');
CREATE TYPE topology_type AS ENUM ('business', 'cluster', 'module', 'host', 'custom');
CREATE TYPE scope_type AS ENUM ('all', 'manual', 'dynamic');

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    updated_by UUID,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    avatar VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    is_system BOOLEAN DEFAULT false,
    last_login_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_users_deleted_at ON users(deleted_at);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_is_active ON users(is_active);

-- Tenants table
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    updated_by UUID,
    name VARCHAR(100) NOT NULL,
    identifier VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_tenants_deleted_at ON tenants(deleted_at);
CREATE INDEX idx_tenants_identifier ON tenants(identifier);

-- Tenant memberships table
CREATE TABLE tenant_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    updated_by UUID,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, tenant_id)
);

CREATE INDEX idx_tenant_memberships_deleted_at ON tenant_memberships(deleted_at);
CREATE INDEX idx_tenant_memberships_user_id ON tenant_memberships(user_id);
CREATE INDEX idx_tenant_memberships_tenant_id ON tenant_memberships(tenant_id);

-- Permissions table
CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    updated_by UUID,
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    is_built_in BOOLEAN DEFAULT false,
    UNIQUE(resource, action)
);

CREATE INDEX idx_permissions_deleted_at ON permissions(deleted_at);
CREATE INDEX idx_permissions_resource ON permissions(resource);

-- Roles table
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    updated_by UUID,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    identifier VARCHAR(100) NOT NULL,
    description TEXT,
    is_built_in BOOLEAN DEFAULT false,
    is_system BOOLEAN DEFAULT false
);

CREATE INDEX idx_roles_deleted_at ON roles(deleted_at);
CREATE INDEX idx_roles_tenant_id ON roles(tenant_id);
CREATE UNIQUE INDEX idx_roles_tenant_identifier ON roles(tenant_id, identifier) WHERE deleted_at IS NULL;

-- Role permissions table
CREATE TABLE role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    updated_by UUID,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    business_id UUID,
    model_id UUID,
    UNIQUE(role_id, permission_id, business_id, model_id)
);

CREATE INDEX idx_role_permissions_deleted_at ON role_permissions(deleted_at);
CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission_id ON role_permissions(permission_id);

-- User roles table
CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    updated_by UUID,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    business_id UUID,
    expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_user_roles_deleted_at ON user_roles(deleted_at);
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX idx_user_roles_tenant_id ON user_roles(tenant_id);

-- Model groups table
CREATE TABLE model_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    updated_by UUID,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    identifier VARCHAR(100) NOT NULL,
    description TEXT,
    is_built_in BOOLEAN DEFAULT false
);

CREATE INDEX idx_model_groups_deleted_at ON model_groups(deleted_at);
CREATE INDEX idx_model_groups_tenant_id ON model_groups(tenant_id);
CREATE UNIQUE INDEX idx_model_groups_tenant_identifier ON model_groups(tenant_id, identifier) WHERE deleted_at IS NULL;

-- Models table
CREATE TABLE models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    updated_by UUID,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    identifier VARCHAR(100) NOT NULL,
    description TEXT,
    group_id UUID NOT NULL REFERENCES model_groups(id),
    icon VARCHAR(100),
    status model_status DEFAULT 'active',
    is_built_in BOOLEAN DEFAULT false
);

CREATE INDEX idx_models_deleted_at ON models(deleted_at);
CREATE INDEX idx_models_tenant_id ON models(tenant_id);
CREATE INDEX idx_models_group_id ON models(group_id);
CREATE INDEX idx_models_status ON models(status);
CREATE UNIQUE INDEX idx_models_tenant_identifier ON models(tenant_id, identifier) WHERE deleted_at IS NULL;

-- Field groups table
CREATE TABLE field_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    updated_by UUID,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    identifier VARCHAR(100) NOT NULL,
    model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    description TEXT,
    is_collapsible BOOLEAN DEFAULT false,
    is_collapsed BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0
);

CREATE INDEX idx_field_groups_deleted_at ON field_groups(deleted_at);
CREATE INDEX idx_field_groups_tenant_id ON field_groups(tenant_id);
CREATE INDEX idx_field_groups_model_id ON field_groups(model_id);
CREATE INDEX idx_field_groups_display_order ON field_groups(display_order);

-- Fields table
CREATE TABLE fields (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    updated_by UUID,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    identifier VARCHAR(100) NOT NULL,
    model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    group_id UUID REFERENCES field_groups(id) ON DELETE SET NULL,
    type field_type NOT NULL,
    description TEXT,
    is_required BOOLEAN DEFAULT false,
    is_unique BOOLEAN DEFAULT false,
    is_editable BOOLEAN DEFAULT true,
    is_built_in BOOLEAN DEFAULT false,
    default_value TEXT,
    options JSONB,
    display_order INTEGER DEFAULT 0
);

CREATE INDEX idx_fields_deleted_at ON fields(deleted_at);
CREATE INDEX idx_fields_tenant_id ON fields(tenant_id);
CREATE INDEX idx_fields_model_id ON fields(model_id);
CREATE INDEX idx_fields_group_id ON fields(group_id);
CREATE INDEX idx_fields_type ON fields(type);
CREATE INDEX idx_fields_display_order ON fields(display_order);
CREATE UNIQUE INDEX idx_fields_model_identifier ON fields(model_id, identifier) WHERE deleted_at IS NULL;

-- Relationship types table
CREATE TABLE relationship_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    updated_by UUID,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    identifier VARCHAR(100) NOT NULL,
    description TEXT,
    direction VARCHAR(20) DEFAULT 'bidirectional',
    is_built_in BOOLEAN DEFAULT false
);

CREATE INDEX idx_relationship_types_deleted_at ON relationship_types(deleted_at);
CREATE INDEX idx_relationship_types_tenant_id ON relationship_types(tenant_id);
CREATE UNIQUE INDEX idx_relationship_types_tenant_identifier ON relationship_types(tenant_id, identifier) WHERE deleted_at IS NULL;

-- Relationships table
CREATE TABLE relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    updated_by UUID,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    source_model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    target_model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    type_id UUID NOT NULL REFERENCES relationship_types(id),
    constraint_type constraint_type DEFAULT 'N:N',
    is_mandatory BOOLEAN DEFAULT false,
    is_built_in BOOLEAN DEFAULT false
);

CREATE INDEX idx_relationships_deleted_at ON relationships(deleted_at);
CREATE INDEX idx_relationships_tenant_id ON relationships(tenant_id);
CREATE INDEX idx_relationships_source_model_id ON relationships(source_model_id);
CREATE INDEX idx_relationships_target_model_id ON relationships(target_model_id);
CREATE INDEX idx_relationships_type_id ON relationships(type_id);

-- Businesses table
CREATE TABLE businesses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    updated_by UUID,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    identifier VARCHAR(100) NOT NULL,
    description TEXT,
    lifecycle VARCHAR(50) DEFAULT 'production',
    timezone VARCHAR(50) DEFAULT 'UTC',
    language VARCHAR(10) DEFAULT 'en',
    maintainers UUID[] NOT NULL,
    is_built_in BOOLEAN DEFAULT false
);

CREATE INDEX idx_businesses_deleted_at ON businesses(deleted_at);
CREATE INDEX idx_businesses_tenant_id ON businesses(tenant_id);
CREATE INDEX idx_businesses_lifecycle ON businesses(lifecycle);
CREATE UNIQUE INDEX idx_businesses_tenant_identifier ON businesses(tenant_id, identifier) WHERE deleted_at IS NULL;

-- Business sets table
CREATE TABLE business_sets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    updated_by UUID,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    identifier VARCHAR(100) NOT NULL,
    description TEXT,
    scope JSONB NOT NULL,
    maintainers UUID[] NOT NULL
);

CREATE INDEX idx_business_sets_deleted_at ON business_sets(deleted_at);
CREATE INDEX idx_business_sets_tenant_id ON business_sets(tenant_id);
CREATE UNIQUE INDEX idx_business_sets_tenant_identifier ON business_sets(tenant_id, identifier) WHERE deleted_at IS NULL;

-- Business set members table (many-to-many)
CREATE TABLE business_set_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    business_set_id UUID NOT NULL REFERENCES business_sets(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    UNIQUE(business_set_id, business_id)
);

CREATE INDEX idx_business_set_members_business_set_id ON business_set_members(business_set_id);
CREATE INDEX idx_business_set_members_business_id ON business_set_members(business_id);

-- Instances table
CREATE TABLE instances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    updated_by UUID,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    status instance_status DEFAULT 'active',
    data JSONB NOT NULL
);

CREATE INDEX idx_instances_deleted_at ON instances(deleted_at);
CREATE INDEX idx_instances_tenant_id ON instances(tenant_id);
CREATE INDEX idx_instances_model_id ON instances(model_id);
CREATE INDEX idx_instances_status ON instances(status);
CREATE INDEX idx_instances_name ON instances(name);
CREATE INDEX idx_instances_data_gin ON instances USING GIN(data);

-- Instance relationships table
CREATE TABLE instance_relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    updated_by UUID,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    source_instance_id UUID NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
    target_instance_id UUID NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
    relationship_id UUID NOT NULL REFERENCES relationships(id) ON DELETE CASCADE
);

CREATE INDEX idx_instance_relationships_deleted_at ON instance_relationships(deleted_at);
CREATE INDEX idx_instance_relationships_tenant_id ON instance_relationships(tenant_id);
CREATE INDEX idx_instance_relationships_source_instance_id ON instance_relationships(source_instance_id);
CREATE INDEX idx_instance_relationships_target_instance_id ON instance_relationships(target_instance_id);
CREATE INDEX idx_instance_relationships_relationship_id ON instance_relationships(relationship_id);

-- Topology nodes table
CREATE TABLE topology_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    updated_by UUID,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES topology_nodes(id) ON DELETE CASCADE,
    model_id UUID NOT NULL REFERENCES models(id),
    instance_id UUID REFERENCES instances(id) ON DELETE SET NULL,
    name VARCHAR(200) NOT NULL,
    level INTEGER NOT NULL,
    path TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    topology_type topology_type DEFAULT 'custom'
);

CREATE INDEX idx_topology_nodes_deleted_at ON topology_nodes(deleted_at);
CREATE INDEX idx_topology_nodes_tenant_id ON topology_nodes(tenant_id);
CREATE INDEX idx_topology_nodes_business_id ON topology_nodes(business_id);
CREATE INDEX idx_topology_nodes_parent_id ON topology_nodes(parent_id);
CREATE INDEX idx_topology_nodes_model_id ON topology_nodes(model_id);
CREATE INDEX idx_topology_nodes_instance_id ON topology_nodes(instance_id);
CREATE INDEX idx_topology_nodes_level ON topology_nodes(level);
CREATE INDEX idx_topology_nodes_path ON topology_nodes(path);
CREATE INDEX idx_topology_nodes_path_gin ON topology_nodes USING GIN(to_tsvector('english', path));

-- Service templates table
CREATE TABLE service_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    updated_by UUID,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    model_id UUID NOT NULL REFERENCES models(id),
    template JSONB NOT NULL
);

CREATE INDEX idx_service_templates_deleted_at ON service_templates(deleted_at);
CREATE INDEX idx_service_templates_tenant_id ON service_templates(tenant_id);
CREATE INDEX idx_service_templates_business_id ON service_templates(business_id);
CREATE INDEX idx_service_templates_model_id ON service_templates(model_id);

-- Cluster templates table
CREATE TABLE cluster_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    updated_by UUID,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    model_id UUID NOT NULL REFERENCES models(id),
    template JSONB NOT NULL
);

CREATE INDEX idx_cluster_templates_deleted_at ON cluster_templates(deleted_at);
CREATE INDEX idx_cluster_templates_tenant_id ON cluster_templates(tenant_id);
CREATE INDEX idx_cluster_templates_business_id ON cluster_templates(business_id);
CREATE INDEX idx_cluster_templates_model_id ON cluster_templates(model_id);

-- Dynamic groups table
CREATE TABLE dynamic_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    updated_by UUID,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    target_type VARCHAR(50) NOT NULL,
    model_id UUID REFERENCES models(id) ON DELETE SET NULL,
    business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
    query JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_dynamic_groups_deleted_at ON dynamic_groups(deleted_at);
CREATE INDEX idx_dynamic_groups_tenant_id ON dynamic_groups(tenant_id);
CREATE INDEX idx_dynamic_groups_target_type ON dynamic_groups(target_type);
CREATE INDEX idx_dynamic_groups_model_id ON dynamic_groups(model_id);
CREATE INDEX idx_dynamic_groups_business_id ON dynamic_groups(business_id);
CREATE INDEX idx_dynamic_groups_is_active ON dynamic_groups(is_active);

-- Audit logs table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    updated_by UUID,
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    action audit_action NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID NOT NULL,
    resource_name VARCHAR(200),
    business_id UUID,
    client_ip INET,
    user_agent VARCHAR(500),
    request_id VARCHAR(100),
    changes JSONB,
    metadata JSONB,
    success BOOLEAN NOT NULL,
    error_message TEXT
);

CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX idx_audit_logs_resource_id ON audit_logs(resource_id);
CREATE INDEX idx_audit_logs_business_id ON audit_logs(business_id);
CREATE INDEX idx_audit_logs_success ON audit_logs(success);
CREATE INDEX idx_audit_logs_request_id ON audit_logs(request_id);

-- Events table
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    updated_by UUID,
    tenant_id UUID NOT NULL,
    type event_type NOT NULL,
    source VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID NOT NULL,
    business_id UUID,
    payload JSONB NOT NULL,
    status event_status DEFAULT 'pending',
    retry_count INTEGER DEFAULT 0,
    processed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT
);

CREATE INDEX idx_events_created_at ON events(created_at);
CREATE INDEX idx_events_tenant_id ON events(tenant_id);
CREATE INDEX idx_events_type ON events(type);
CREATE INDEX idx_events_resource_type ON events(resource_type);
CREATE INDEX idx_events_resource_id ON events(resource_id);
CREATE INDEX idx_events_business_id ON events(business_id);
CREATE INDEX idx_events_status ON events(status);

-- Event subscriptions table
CREATE TABLE event_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    updated_by UUID,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    event_types TEXT[] NOT NULL,
    resource_types TEXT[] NOT NULL,
    business_ids UUID[],
    endpoint JSONB NOT NULL,
    filters JSONB,
    retry_policy JSONB,
    last_delivery TIMESTAMP WITH TIME ZONE,
    delivery_count BIGINT DEFAULT 0,
    failure_count BIGINT DEFAULT 0
);

CREATE INDEX idx_event_subscriptions_deleted_at ON event_subscriptions(deleted_at);
CREATE INDEX idx_event_subscriptions_tenant_id ON event_subscriptions(tenant_id);
CREATE INDEX idx_event_subscriptions_is_active ON event_subscriptions(is_active);

-- Event deliveries table
CREATE TABLE event_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    updated_by UUID,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES event_subscriptions(id) ON DELETE CASCADE,
    status event_status NOT NULL,
    attempt_number INTEGER NOT NULL,
    response_code INTEGER,
    response_body TEXT,
    error_message TEXT,
    delivered_at TIMESTAMP WITH TIME ZONE,
    next_retry_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_event_deliveries_deleted_at ON event_deliveries(deleted_at);
CREATE INDEX idx_event_deliveries_event_id ON event_deliveries(event_id);
CREATE INDEX idx_event_deliveries_subscription_id ON event_deliveries(subscription_id);
CREATE INDEX idx_event_deliveries_status ON event_deliveries(status);
CREATE INDEX idx_event_deliveries_next_retry_at ON event_deliveries(next_retry_at);

-- Add foreign key constraints for self-referencing relationships
ALTER TABLE users ADD CONSTRAINT fk_users_created_by FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE users ADD CONSTRAINT fk_users_updated_by FOREIGN KEY (updated_by) REFERENCES users(id);

-- Add triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for all tables with updated_at column
CREATE TRIGGER trigger_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_tenant_memberships_updated_at BEFORE UPDATE ON tenant_memberships FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_permissions_updated_at BEFORE UPDATE ON permissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_roles_updated_at BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_role_permissions_updated_at BEFORE UPDATE ON role_permissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_user_roles_updated_at BEFORE UPDATE ON user_roles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_model_groups_updated_at BEFORE UPDATE ON model_groups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_models_updated_at BEFORE UPDATE ON models FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_field_groups_updated_at BEFORE UPDATE ON field_groups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_fields_updated_at BEFORE UPDATE ON fields FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_relationship_types_updated_at BEFORE UPDATE ON relationship_types FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_relationships_updated_at BEFORE UPDATE ON relationships FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_businesses_updated_at BEFORE UPDATE ON businesses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_business_sets_updated_at BEFORE UPDATE ON business_sets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_instances_updated_at BEFORE UPDATE ON instances FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_instance_relationships_updated_at BEFORE UPDATE ON instance_relationships FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_topology_nodes_updated_at BEFORE UPDATE ON topology_nodes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_service_templates_updated_at BEFORE UPDATE ON service_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_cluster_templates_updated_at BEFORE UPDATE ON cluster_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_dynamic_groups_updated_at BEFORE UPDATE ON dynamic_groups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_audit_logs_updated_at BEFORE UPDATE ON audit_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_event_subscriptions_updated_at BEFORE UPDATE ON event_subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_event_deliveries_updated_at BEFORE UPDATE ON event_deliveries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();