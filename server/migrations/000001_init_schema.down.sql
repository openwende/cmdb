-- Drop all triggers
DROP TRIGGER IF EXISTS trigger_event_deliveries_updated_at ON event_deliveries;
DROP TRIGGER IF EXISTS trigger_event_subscriptions_updated_at ON event_subscriptions;
DROP TRIGGER IF EXISTS trigger_events_updated_at ON events;
DROP TRIGGER IF EXISTS trigger_audit_logs_updated_at ON audit_logs;
DROP TRIGGER IF EXISTS trigger_dynamic_groups_updated_at ON dynamic_groups;
DROP TRIGGER IF EXISTS trigger_cluster_templates_updated_at ON cluster_templates;
DROP TRIGGER IF EXISTS trigger_service_templates_updated_at ON service_templates;
DROP TRIGGER IF EXISTS trigger_topology_nodes_updated_at ON topology_nodes;
DROP TRIGGER IF EXISTS trigger_instance_relationships_updated_at ON instance_relationships;
DROP TRIGGER IF EXISTS trigger_instances_updated_at ON instances;
DROP TRIGGER IF EXISTS trigger_business_sets_updated_at ON business_sets;
DROP TRIGGER IF EXISTS trigger_businesses_updated_at ON businesses;
DROP TRIGGER IF EXISTS trigger_relationships_updated_at ON relationships;
DROP TRIGGER IF EXISTS trigger_relationship_types_updated_at ON relationship_types;
DROP TRIGGER IF EXISTS trigger_fields_updated_at ON fields;
DROP TRIGGER IF EXISTS trigger_field_groups_updated_at ON field_groups;
DROP TRIGGER IF EXISTS trigger_models_updated_at ON models;
DROP TRIGGER IF EXISTS trigger_model_groups_updated_at ON model_groups;
DROP TRIGGER IF EXISTS trigger_user_roles_updated_at ON user_roles;
DROP TRIGGER IF EXISTS trigger_role_permissions_updated_at ON role_permissions;
DROP TRIGGER IF EXISTS trigger_roles_updated_at ON roles;
DROP TRIGGER IF EXISTS trigger_permissions_updated_at ON permissions;
DROP TRIGGER IF EXISTS trigger_tenant_memberships_updated_at ON tenant_memberships;
DROP TRIGGER IF EXISTS trigger_tenants_updated_at ON tenants;
DROP TRIGGER IF EXISTS trigger_users_updated_at ON users;

-- Drop function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS event_deliveries;
DROP TABLE IF EXISTS event_subscriptions;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS dynamic_groups;
DROP TABLE IF EXISTS cluster_templates;
DROP TABLE IF EXISTS service_templates;
DROP TABLE IF EXISTS topology_nodes;
DROP TABLE IF EXISTS instance_relationships;
DROP TABLE IF EXISTS instances;
DROP TABLE IF EXISTS business_set_members;
DROP TABLE IF EXISTS business_sets;
DROP TABLE IF EXISTS businesses;
DROP TABLE IF EXISTS relationships;
DROP TABLE IF EXISTS relationship_types;
DROP TABLE IF EXISTS fields;
DROP TABLE IF EXISTS field_groups;
DROP TABLE IF EXISTS models;
DROP TABLE IF EXISTS model_groups;
DROP TABLE IF EXISTS user_roles;
DROP TABLE IF EXISTS role_permissions;
DROP TABLE IF EXISTS roles;
DROP TABLE IF EXISTS permissions;
DROP TABLE IF EXISTS tenant_memberships;
DROP TABLE IF EXISTS tenants;
DROP TABLE IF EXISTS users;

-- Drop enum types
DROP TYPE IF EXISTS scope_type;
DROP TYPE IF EXISTS topology_type;
DROP TYPE IF EXISTS constraint_type;
DROP TYPE IF EXISTS relation_type;
DROP TYPE IF EXISTS field_type;
DROP TYPE IF EXISTS event_status;
DROP TYPE IF EXISTS event_type;
DROP TYPE IF EXISTS audit_action;
DROP TYPE IF EXISTS instance_status;
DROP TYPE IF EXISTS model_status;
DROP TYPE IF EXISTS user_status;