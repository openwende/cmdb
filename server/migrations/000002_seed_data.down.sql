-- Remove seed data in reverse order

-- Delete default business
DELETE FROM businesses WHERE identifier = 'default';

-- Delete built-in fields
DELETE FROM fields WHERE is_built_in = true;

-- Delete built-in relationship types
DELETE FROM relationship_types WHERE is_built_in = true;

-- Delete default field groups
DELETE FROM field_groups WHERE identifier = 'default';

-- Delete built-in models
DELETE FROM models WHERE is_built_in = true;

-- Delete built-in model groups
DELETE FROM model_groups WHERE is_built_in = true;

-- Delete user roles
DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE username IN ('admin', 'system'));

-- Delete tenant memberships
DELETE FROM tenant_memberships WHERE user_id IN (SELECT id FROM users WHERE username IN ('admin', 'system'));

-- Delete admin and system users
DELETE FROM users WHERE username IN ('admin', 'system');

-- Delete default tenant
DELETE FROM tenants WHERE identifier = 'default';

-- Delete role permissions
DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE is_built_in = true);

-- Delete built-in roles
DELETE FROM roles WHERE is_built_in = true;

-- Delete built-in permissions
DELETE FROM permissions WHERE is_built_in = true;