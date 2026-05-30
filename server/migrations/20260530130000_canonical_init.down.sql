DROP TABLE IF EXISTS
    auth_user_roles, auth_users,
    resource_pool_hosts, resource_directories,
    set_template_service_bindings, set_templates,
    process_statuses, processes, process_templates, service_templates, service_categories,
    model_unique_rule_fields, model_unique_rules,
    resource_histories, relations, model_associations, association_types,
    resource_states, resources, dynamic_attributes, dynamic_models,
    model_instances,
    host_module_relations, host_business_relations, hosts,
    mainline_instances, modules, sets,
    dynamic_groups, business_custom_fields, business_custom_field_groups,
    business_set_members, business_sets, business_personnel,
    model_attributes, models, model_groups,
    cloud_areas, platform_settings, businesses
    CASCADE;
DROP SEQUENCE IF EXISTS businesses_id_seq;
DROP EXTENSION IF EXISTS ltree;
