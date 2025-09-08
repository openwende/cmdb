-- Insert default permissions
INSERT INTO permissions (id, resource, action, description, is_built_in, created_at, updated_at) VALUES
    (uuid_generate_v4(), 'model', 'create', 'Create models', true, NOW(), NOW()),
    (uuid_generate_v4(), 'model', 'read', 'Read models', true, NOW(), NOW()),
    (uuid_generate_v4(), 'model', 'update', 'Update models', true, NOW(), NOW()),
    (uuid_generate_v4(), 'model', 'delete', 'Delete models', true, NOW(), NOW()),
    (uuid_generate_v4(), 'instance', 'create', 'Create instances', true, NOW(), NOW()),
    (uuid_generate_v4(), 'instance', 'read', 'Read instances', true, NOW(), NOW()),
    (uuid_generate_v4(), 'instance', 'update', 'Update instances', true, NOW(), NOW()),
    (uuid_generate_v4(), 'instance', 'delete', 'Delete instances', true, NOW(), NOW()),
    (uuid_generate_v4(), 'business', 'create', 'Create businesses', true, NOW(), NOW()),
    (uuid_generate_v4(), 'business', 'read', 'Read businesses', true, NOW(), NOW()),
    (uuid_generate_v4(), 'business', 'update', 'Update businesses', true, NOW(), NOW()),
    (uuid_generate_v4(), 'business', 'delete', 'Delete businesses', true, NOW(), NOW()),
    (uuid_generate_v4(), 'topology', 'create', 'Create topology', true, NOW(), NOW()),
    (uuid_generate_v4(), 'topology', 'read', 'Read topology', true, NOW(), NOW()),
    (uuid_generate_v4(), 'topology', 'update', 'Update topology', true, NOW(), NOW()),
    (uuid_generate_v4(), 'topology', 'delete', 'Delete topology', true, NOW(), NOW()),
    (uuid_generate_v4(), 'user', 'create', 'Create users', true, NOW(), NOW()),
    (uuid_generate_v4(), 'user', 'read', 'Read users', true, NOW(), NOW()),
    (uuid_generate_v4(), 'user', 'update', 'Update users', true, NOW(), NOW()),
    (uuid_generate_v4(), 'user', 'delete', 'Delete users', true, NOW(), NOW()),
    (uuid_generate_v4(), 'audit', 'read', 'Read audit logs', true, NOW(), NOW()),
    (uuid_generate_v4(), '*', '*', 'All permissions', true, NOW(), NOW());

-- Insert system roles
INSERT INTO roles (id, name, identifier, description, is_built_in, is_system, created_at, updated_at) VALUES
    (uuid_generate_v4(), 'System Administrator', 'system_admin', 'Full system access', true, true, NOW(), NOW()),
    (uuid_generate_v4(), 'Tenant Administrator', 'tenant_admin', 'Full tenant access', true, false, NOW(), NOW()),
    (uuid_generate_v4(), 'Business Administrator', 'business_admin', 'Business administration access', true, false, NOW(), NOW()),
    (uuid_generate_v4(), 'Business Operations', 'business_ops', 'Business operations access', true, false, NOW(), NOW()),
    (uuid_generate_v4(), 'Business Viewer', 'business_viewer', 'Business read-only access', true, false, NOW(), NOW()),
    (uuid_generate_v4(), 'Guest', 'guest', 'Limited read-only access', true, false, NOW(), NOW());

-- Assign permissions to system admin role (all permissions)
INSERT INTO role_permissions (id, role_id, permission_id, created_at, updated_at)
SELECT 
    uuid_generate_v4(),
    (SELECT id FROM roles WHERE identifier = 'system_admin'),
    (SELECT id FROM permissions WHERE resource = '*' AND action = '*'),
    NOW(),
    NOW();

-- Assign permissions to tenant admin role
INSERT INTO role_permissions (id, role_id, permission_id, created_at, updated_at)
SELECT 
    uuid_generate_v4(),
    (SELECT id FROM roles WHERE identifier = 'tenant_admin'),
    p.id,
    NOW(),
    NOW()
FROM permissions p
WHERE p.resource IN ('model', 'instance', 'business', 'topology', 'user', 'audit');

-- Assign permissions to business admin role
INSERT INTO role_permissions (id, role_id, permission_id, created_at, updated_at)
SELECT 
    uuid_generate_v4(),
    (SELECT id FROM roles WHERE identifier = 'business_admin'),
    p.id,
    NOW(),
    NOW()
FROM permissions p
WHERE p.resource IN ('instance', 'topology') 
   OR (p.resource = 'business' AND p.action IN ('read', 'update'))
   OR (p.resource = 'model' AND p.action = 'read');

-- Assign permissions to business ops role
INSERT INTO role_permissions (id, role_id, permission_id, created_at, updated_at)
SELECT 
    uuid_generate_v4(),
    (SELECT id FROM roles WHERE identifier = 'business_ops'),
    p.id,
    NOW(),
    NOW()
FROM permissions p
WHERE (p.resource = 'instance' AND p.action IN ('create', 'read', 'update'))
   OR (p.resource = 'topology' AND p.action IN ('read', 'update'))
   OR (p.resource = 'business' AND p.action = 'read')
   OR (p.resource = 'model' AND p.action = 'read');

-- Assign permissions to business viewer role
INSERT INTO role_permissions (id, role_id, permission_id, created_at, updated_at)
SELECT 
    uuid_generate_v4(),
    (SELECT id FROM roles WHERE identifier = 'business_viewer'),
    p.id,
    NOW(),
    NOW()
FROM permissions p
WHERE p.action = 'read' AND p.resource IN ('instance', 'topology', 'business', 'model');

-- Assign permissions to guest role
INSERT INTO role_permissions (id, role_id, permission_id, created_at, updated_at)
SELECT 
    uuid_generate_v4(),
    (SELECT id FROM roles WHERE identifier = 'guest'),
    p.id,
    NOW(),
    NOW()
FROM permissions p
WHERE p.action = 'read' AND p.resource IN ('business', 'model');

-- Create default tenant
INSERT INTO tenants (id, name, identifier, description, is_active, created_at, updated_at) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Default Tenant', 'default', 'Default system tenant', true, NOW(), NOW());

-- Create system user (for internal operations)
INSERT INTO users (id, username, email, display_name, password_hash, is_active, is_system, created_at, updated_at) VALUES
    (uuid_generate_v4(), 'system', 'system@wend-cmdb.local', 'System User', '$2a$10$dummy_hash_for_system_user', true, true, NOW(), NOW());

-- Create admin user (default password: admin123)
-- Password hash for 'admin123' using bcrypt
INSERT INTO users (id, username, email, display_name, password_hash, is_active, is_system, created_at, updated_at) VALUES
    (uuid_generate_v4(), 'admin', 'admin@wend-cmdb.local', 'Administrator', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', true, false, NOW(), NOW());

-- Add admin user to default tenant
INSERT INTO tenant_memberships (id, user_id, tenant_id, is_active, joined_at, created_at, updated_at)
SELECT 
    uuid_generate_v4(),
    u.id,
    t.id,
    true,
    NOW(),
    NOW(),
    NOW()
FROM users u, tenants t
WHERE u.username = 'admin' AND t.identifier = 'default';

-- Add system user to default tenant
INSERT INTO tenant_memberships (id, user_id, tenant_id, is_active, joined_at, created_at, updated_at)
SELECT 
    uuid_generate_v4(),
    u.id,
    t.id,
    true,
    NOW(),
    NOW(),
    NOW()
FROM users u, tenants t
WHERE u.username = 'system' AND t.identifier = 'default';

-- Assign system admin role to admin user in default tenant
INSERT INTO user_roles (id, user_id, role_id, tenant_id, created_by, updated_by)
SELECT 
    uuid_generate_v4(),
    u.id,
    r.id,
    t.id,
    (SELECT id FROM users WHERE username = 'system'),
    (SELECT id FROM users WHERE username = 'system')
FROM users u, roles r, tenants t
WHERE u.username = 'admin' 
  AND r.identifier = 'system_admin'
  AND t.identifier = 'default';

-- Create default model groups for default tenant
INSERT INTO model_groups (id, tenant_id, name, identifier, description, is_built_in, created_at, updated_at, created_by)
SELECT 
    uuid_generate_v4(),
    t.id,
    'Host Management',
    'host_management',
    'Models for host and infrastructure management',
    true,
    NOW(),
    NOW(),
    u.id
FROM tenants t, users u
WHERE t.identifier = 'default' AND u.username = 'system'
UNION ALL
SELECT 
    uuid_generate_v4(),
    t.id,
    'Business Topology',
    'business_topology',
    'Models for business topology management',
    true,
    NOW(),
    NOW(),
    u.id
FROM tenants t, users u
WHERE t.identifier = 'default' AND u.username = 'system'
UNION ALL
SELECT 
    uuid_generate_v4(),
    t.id,
    'Organization',
    'organization',
    'Models for organizational structure',
    true,
    NOW(),
    NOW(),
    u.id
FROM tenants t, users u
WHERE t.identifier = 'default' AND u.username = 'system'
UNION ALL
SELECT 
    uuid_generate_v4(),
    t.id,
    'Network',
    'network',
    'Models for network infrastructure',
    true,
    NOW(),
    NOW(),
    u.id
FROM tenants t, users u
WHERE t.identifier = 'default' AND u.username = 'system';

-- Create built-in models for default tenant
INSERT INTO models (id, tenant_id, name, identifier, description, group_id, icon, status, is_built_in, created_at, updated_at, created_by)
SELECT 
    uuid_generate_v4(),
    t.id,
    'Host',
    'host',
    'Physical or virtual server',
    mg.id,
    'server',
    'active'::model_status,
    true,
    NOW(),
    NOW(),
    u.id
FROM tenants t, model_groups mg, users u
WHERE t.identifier = 'default' 
  AND mg.identifier = 'host_management' 
  AND mg.tenant_id = t.id
  AND u.username = 'system'
UNION ALL
SELECT 
    uuid_generate_v4(),
    t.id,
    'Business',
    'business',
    'Business unit or organization',
    mg.id,
    'business',
    'active'::model_status,
    true,
    NOW(),
    NOW(),
    u.id
FROM tenants t, model_groups mg, users u
WHERE t.identifier = 'default' 
  AND mg.identifier = 'business_topology' 
  AND mg.tenant_id = t.id
  AND u.username = 'system'
UNION ALL
SELECT 
    uuid_generate_v4(),
    t.id,
    'Cluster',
    'cluster',
    'Cluster of services',
    mg.id,
    'cluster',
    'active'::model_status,
    true,
    NOW(),
    NOW(),
    u.id
FROM tenants t, model_groups mg, users u
WHERE t.identifier = 'default' 
  AND mg.identifier = 'business_topology' 
  AND mg.tenant_id = t.id
  AND u.username = 'system'
UNION ALL
SELECT 
    uuid_generate_v4(),
    t.id,
    'Module',
    'module',
    'Service module',
    mg.id,
    'module',
    'active'::model_status,
    true,
    NOW(),
    NOW(),
    u.id
FROM tenants t, model_groups mg, users u
WHERE t.identifier = 'default' 
  AND mg.identifier = 'business_topology' 
  AND mg.tenant_id = t.id
  AND u.username = 'system';

-- Create default field groups for models
INSERT INTO field_groups (id, tenant_id, name, identifier, model_id, description, is_collapsible, is_collapsed, display_order, created_at, updated_at, created_by)
SELECT 
    uuid_generate_v4(),
    t.id,
    'Default',
    'default',
    m.id,
    'Default field group',
    false,
    false,
    0,
    NOW(),
    NOW(),
    u.id
FROM tenants t, models m, users u
WHERE t.identifier = 'default' 
  AND m.tenant_id = t.id
  AND u.username = 'system';

-- Create built-in relationship types for default tenant
INSERT INTO relationship_types (id, tenant_id, name, identifier, description, direction, is_built_in, created_at, updated_at, created_by)
SELECT 
    uuid_generate_v4(),
    t.id,
    'Belongs To',
    'belongs_to',
    'Belongs to relationship',
    'forward',
    true,
    NOW(),
    NOW(),
    u.id
FROM tenants t, users u
WHERE t.identifier = 'default' AND u.username = 'system'
UNION ALL
SELECT 
    uuid_generate_v4(),
    t.id,
    'Composed Of',
    'composed_of',
    'Composition relationship',
    'forward',
    true,
    NOW(),
    NOW(),
    u.id
FROM tenants t, users u
WHERE t.identifier = 'default' AND u.username = 'system'
UNION ALL
SELECT 
    uuid_generate_v4(),
    t.id,
    'Running',
    'running',
    'Running relationship',
    'forward',
    true,
    NOW(),
    NOW(),
    u.id
FROM tenants t, users u
WHERE t.identifier = 'default' AND u.username = 'system'
UNION ALL
SELECT 
    uuid_generate_v4(),
    t.id,
    'Default',
    'default',
    'Default relationship',
    'bidirectional',
    true,
    NOW(),
    NOW(),
    u.id
FROM tenants t, users u
WHERE t.identifier = 'default' AND u.username = 'system';

-- Add essential fields to Host model
INSERT INTO fields (id, tenant_id, name, identifier, model_id, group_id, type, description, is_required, is_unique, is_editable, is_built_in, display_order, created_at, updated_at, created_by)
SELECT 
    uuid_generate_v4(),
    t.id,
    'Instance Name',
    'instance_name',
    m.id,
    fg.id,
    'string'::field_type,
    'Name of the instance',
    true,
    false,
    true,
    true,
    1,
    NOW(),
    NOW(),
    u.id
FROM tenants t, models m, field_groups fg, users u
WHERE t.identifier = 'default' 
  AND m.identifier = 'host' 
  AND m.tenant_id = t.id
  AND fg.model_id = m.id 
  AND fg.identifier = 'default'
  AND u.username = 'system'
UNION ALL
SELECT 
    uuid_generate_v4(),
    t.id,
    'IP Address',
    'ip_address',
    m.id,
    fg.id,
    'string'::field_type,
    'Primary IP address',
    false,
    true,
    true,
    true,
    2,
    NOW(),
    NOW(),
    u.id
FROM tenants t, models m, field_groups fg, users u
WHERE t.identifier = 'default' 
  AND m.identifier = 'host' 
  AND m.tenant_id = t.id
  AND fg.model_id = m.id 
  AND fg.identifier = 'default'
  AND u.username = 'system'
UNION ALL
SELECT 
    uuid_generate_v4(),
    t.id,
    'Operating System',
    'os',
    m.id,
    fg.id,
    'string'::field_type,
    'Operating system',
    false,
    false,
    true,
    true,
    3,
    NOW(),
    NOW(),
    u.id
FROM tenants t, models m, field_groups fg, users u
WHERE t.identifier = 'default' 
  AND m.identifier = 'host' 
  AND m.tenant_id = t.id
  AND fg.model_id = m.id 
  AND fg.identifier = 'default'
  AND u.username = 'system'
UNION ALL
SELECT 
    uuid_generate_v4(),
    t.id,
    'Status',
    'status',
    m.id,
    fg.id,
    'enum'::field_type,
    'Host status',
    true,
    false,
    true,
    true,
    4,
    NOW(),
    NOW(),
    u.id
FROM tenants t, models m, field_groups fg, users u
WHERE t.identifier = 'default' 
  AND m.identifier = 'host' 
  AND m.tenant_id = t.id
  AND fg.model_id = m.id 
  AND fg.identifier = 'default'
  AND u.username = 'system';

-- Update status field with enum options
UPDATE fields 
SET options = '{
    "enum_values": [
        {"key": "active", "value": "Active", "description": "Host is active", "is_default": true},
        {"key": "inactive", "value": "Inactive", "description": "Host is inactive"},
        {"key": "maintenance", "value": "Maintenance", "description": "Host is under maintenance"}
    ]
}'::jsonb
WHERE identifier = 'status' 
  AND model_id IN (SELECT id FROM models WHERE identifier = 'host');

-- Create default business
INSERT INTO businesses (id, tenant_id, name, identifier, description, lifecycle, timezone, language, maintainers, is_built_in, created_at, updated_at, created_by)
SELECT 
    uuid_generate_v4(),
    t.id,
    'Default Business',
    'default',
    'Default business for system initialization',
    'production',
    'UTC',
    'en',
    ARRAY[u.id]::UUID[],
    true,
    NOW(),
    NOW(),
    u.id
FROM tenants t, users u
WHERE t.identifier = 'default' AND u.username = 'admin';