-- Canonical initial schema — cmdb-server (fresh DB)
-- 取代旧增量迁移链。business 主键/外键统一 BIGINT。
-- seed 数据不在此文件(收敛为独立 Go seed 步骤)。

CREATE EXTENSION IF NOT EXISTS ltree;

-- ============================================================
-- businesses(BIGINT 主键,序列 START 1000)
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS businesses_id_seq START 1000;

CREATE TABLE businesses (
    id          BIGINT PRIMARY KEY DEFAULT nextval('businesses_id_seq'),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ,
    created_by  UUID,
    updated_by  UUID,
    tenant_id   UUID NOT NULL,
    name        TEXT NOT NULL,
    identifier  TEXT NOT NULL,
    description TEXT,
    lifecycle   TEXT NOT NULL DEFAULT 'online',
    timezone    TEXT NOT NULL DEFAULT 'UTC',
    language    TEXT NOT NULL DEFAULT 'en',
    maintainers UUID[] DEFAULT '{}',
    is_built_in BOOLEAN NOT NULL DEFAULT FALSE
);
ALTER SEQUENCE businesses_id_seq OWNED BY businesses.id;
CREATE UNIQUE INDEX idx_businesses_identifier_tenant ON businesses (identifier, tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_businesses_tenant_id ON businesses (tenant_id);

-- ============================================================
-- platform_settings(全局键值设置;拓扑设置由 mainline lazy 填充)
-- ============================================================
CREATE TABLE platform_settings (
    key         VARCHAR(100) PRIMARY KEY,
    value       JSONB NOT NULL,
    description VARCHAR(500),
    updated_by  VARCHAR(100),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 元模型(A 套:models / model_attributes / model_instances 分区)
-- ============================================================
CREATE TABLE model_groups (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    description  TEXT DEFAULT '',
    sort_order   INT NOT NULL DEFAULT 0,
    is_builtin   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE models (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                     VARCHAR(100) UNIQUE NOT NULL,
    display_name             VARCHAR(200) NOT NULL,
    classification           VARCHAR(50) NOT NULL,
    group_id                 UUID REFERENCES model_groups(id),
    icon                     VARCHAR(100),
    is_builtin               BOOLEAN DEFAULT FALSE,
    is_mainline              BOOLEAN NOT NULL DEFAULT FALSE,
    mainline_scope           VARCHAR(20) NOT NULL DEFAULT 'none',
    mainline_level           INTEGER,
    is_topology_builtin      BOOLEAN NOT NULL DEFAULT FALSE,
    mainline_parent_model_id UUID REFERENCES models(id) ON DELETE SET NULL,
    description              TEXT,
    created_at               TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_models_group_id    ON models (group_id);
CREATE INDEX idx_models_is_mainline ON models (is_mainline) WHERE is_mainline = TRUE;
CREATE UNIQUE INDEX idx_models_mainline_level ON models (mainline_level) WHERE is_mainline = TRUE AND mainline_level IS NOT NULL;

CREATE TABLE model_attributes (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id     UUID REFERENCES models(id) ON DELETE CASCADE,
    name         VARCHAR(100) NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    field_type   VARCHAR(50) NOT NULL,
    is_required  BOOLEAN DEFAULT FALSE,
    is_unique    BOOLEAN DEFAULT FALSE,
    is_editable  BOOLEAN DEFAULT TRUE,
    is_system    BOOLEAN DEFAULT FALSE,
    options      JSONB DEFAULT '{}',
    sort_order   INT DEFAULT 0,
    created_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (model_id, name)
);

-- ============================================================
-- cloud_areas(被 hosts 引用)
-- ============================================================
CREATE TABLE cloud_areas (
    id             UUID PRIMARY KEY,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at     TIMESTAMPTZ,
    tenant_id      UUID NOT NULL,
    name           TEXT NOT NULL,
    identifier     TEXT NOT NULL,
    type           TEXT DEFAULT 'direct',
    description    TEXT,
    cloud_vendor   TEXT,
    vpc_id         TEXT,
    cidr_block     TEXT,
    region         TEXT,
    cloud_metadata JSONB,
    custom_fields  JSONB,
    CONSTRAINT chk_cloud_areas_type CHECK (type IN ('direct', 'vpc', 'custom')),
    CONSTRAINT chk_cloud_areas_vendor CHECK (cloud_vendor IS NULL OR cloud_vendor IN ('aws','tencent_cloud','aliyun','custom'))
);
CREATE UNIQUE INDEX idx_cloud_areas_identifier_tenant ON cloud_areas (identifier, tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_cloud_areas_tenant_id     ON cloud_areas (tenant_id);
CREATE INDEX idx_cloud_areas_cloud_vendor  ON cloud_areas (cloud_vendor);
CREATE INDEX idx_cloud_areas_region        ON cloud_areas (region);
CREATE INDEX idx_cloud_areas_vpc_id        ON cloud_areas (vpc_id);
CREATE INDEX idx_cloud_areas_cloud_metadata ON cloud_areas USING GIN (cloud_metadata);
CREATE INDEX idx_cloud_areas_custom_fields  ON cloud_areas USING GIN (custom_fields);

-- 默认直连区域(系统固定数据,创建主机依赖 GetDefaultCloudArea,无 lazy 兜底;canonical 内唯一最小 seed)
INSERT INTO cloud_areas (id, tenant_id, name, identifier, type, description)
VALUES ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000',
        '直连区域', 'default', 'direct', '默认直连区域，用于非云环境的主机')
ON CONFLICT DO NOTHING;

-- ============================================================
-- business 关联表
-- ============================================================
CREATE TABLE business_personnel (
    id          UUID PRIMARY KEY,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    business_id BIGINT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    user_id     UUID,
    identity    TEXT NOT NULL,
    role        TEXT NOT NULL
);
CREATE INDEX idx_business_personnel_business_id ON business_personnel (business_id);
CREATE INDEX idx_business_personnel_role ON business_personnel (role);

CREATE TABLE business_sets (
    id          UUID PRIMARY KEY,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ,
    created_by  UUID,
    updated_by  UUID,
    tenant_id   UUID NOT NULL,
    name        TEXT NOT NULL,
    identifier  TEXT NOT NULL,
    description TEXT,
    scope       TEXT,
    maintainers UUID[] DEFAULT '{}'
);
CREATE UNIQUE INDEX idx_business_sets_identifier_tenant ON business_sets (identifier, tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_business_sets_tenant_id ON business_sets (tenant_id);

CREATE TABLE business_set_members (
    id              UUID PRIMARY KEY,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    business_set_id UUID NOT NULL REFERENCES business_sets(id) ON DELETE CASCADE,
    business_id     BIGINT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    CONSTRAINT uniq_business_set_member UNIQUE (business_set_id, business_id)
);
CREATE INDEX idx_business_set_members_business_set_id ON business_set_members (business_set_id);
CREATE INDEX idx_business_set_members_business_id ON business_set_members (business_id);

CREATE TABLE business_custom_field_groups (
    id                   BIGSERIAL PRIMARY KEY,
    business_id          BIGINT NOT NULL,
    object_type          VARCHAR(20) NOT NULL,
    name                 VARCHAR(100) NOT NULL,
    collapsed_by_default BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order           INT NOT NULL DEFAULT 0,
    created_by           VARCHAR(100),
    updated_by           VARCHAR(100),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at           TIMESTAMPTZ,
    CONSTRAINT chk_bcfg_object_type CHECK (object_type IN ('set', 'module', 'host'))
);
CREATE UNIQUE INDEX uk_bcfg_name_active ON business_custom_field_groups (business_id, object_type, name) WHERE deleted_at IS NULL;
CREATE INDEX idx_bcfg_business_object ON business_custom_field_groups (business_id, object_type, sort_order) WHERE deleted_at IS NULL;

CREATE TABLE business_custom_fields (
    id            BIGSERIAL PRIMARY KEY,
    business_id   BIGINT NOT NULL,
    object_type   VARCHAR(20) NOT NULL,
    group_id      BIGINT REFERENCES business_custom_field_groups(id) ON DELETE SET NULL,
    field_uid     VARCHAR(50) NOT NULL,
    field_name    VARCHAR(100) NOT NULL,
    field_type    VARCHAR(20) NOT NULL,
    is_required   BOOLEAN NOT NULL DEFAULT FALSE,
    is_editable   BOOLEAN NOT NULL DEFAULT TRUE,
    is_unique     BOOLEAN NOT NULL DEFAULT FALSE,
    default_value VARCHAR(500),
    placeholder   VARCHAR(200),
    validators    JSONB NOT NULL DEFAULT '{}'::jsonb,
    options       JSONB NOT NULL DEFAULT '{}'::jsonb,
    sort_order    INT NOT NULL DEFAULT 0,
    created_by    VARCHAR(100),
    updated_by    VARCHAR(100),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at    TIMESTAMPTZ,
    CONSTRAINT chk_bcf_object_type CHECK (object_type IN ('set', 'module', 'host'))
);
CREATE UNIQUE INDEX uk_bcf_uid_active  ON business_custom_fields (business_id, object_type, field_uid) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uk_bcf_name_active ON business_custom_fields (business_id, object_type, field_name) WHERE deleted_at IS NULL;
CREATE INDEX idx_bcf_business_object_group ON business_custom_fields (business_id, object_type, group_id, sort_order) WHERE deleted_at IS NULL;
CREATE INDEX idx_bcf_validators_gin ON business_custom_fields USING GIN (validators);
CREATE INDEX idx_bcf_options_gin    ON business_custom_fields USING GIN (options);

CREATE TABLE dynamic_groups (
    id                 UUID PRIMARY KEY,
    business_id        BIGINT NOT NULL,
    name               VARCHAR(100) NOT NULL,
    target_model_uid   VARCHAR(50) NOT NULL,
    condition          JSONB NOT NULL DEFAULT '[]'::jsonb,
    last_preview_count INT NOT NULL DEFAULT 0,
    description        VARCHAR(500),
    created_by         VARCHAR(100),
    updated_by         VARCHAR(100),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at         TIMESTAMPTZ
);
CREATE UNIQUE INDEX uk_dynamic_groups_biz_name_active ON dynamic_groups (business_id, name) WHERE deleted_at IS NULL;
CREATE INDEX idx_dynamic_groups_business_target ON dynamic_groups (business_id, target_model_uid) WHERE deleted_at IS NULL;
CREATE INDEX idx_dynamic_groups_condition_gin ON dynamic_groups USING GIN (condition);

-- ============================================================
-- 拓扑:sets / modules / mainline_instances
-- ============================================================
CREATE TABLE sets (
    id          BIGSERIAL PRIMARY KEY,
    business_id BIGINT NOT NULL,
    name        VARCHAR(200) NOT NULL,
    description VARCHAR(500),
    env_type    VARCHAR(50),
    sort_order  INTEGER NOT NULL DEFAULT 0,
    is_default  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ,
    CONSTRAINT fk_sets_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);
CREATE INDEX idx_sets_business_id ON sets (business_id);
CREATE INDEX idx_sets_is_default  ON sets (business_id, is_default) WHERE is_default = TRUE;
CREATE INDEX idx_sets_deleted_at  ON sets (deleted_at);

CREATE TABLE modules (
    id                  BIGSERIAL PRIMARY KEY,
    set_id              BIGINT NOT NULL,
    business_id         BIGINT NOT NULL,
    service_template_id BIGINT,
    service_category_id BIGINT,
    name                VARCHAR(200) NOT NULL,
    description         VARCHAR(500),
    service_type        VARCHAR(50),
    sort_order          INTEGER NOT NULL DEFAULT 0,
    is_default          BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,
    CONSTRAINT fk_modules_set FOREIGN KEY (set_id) REFERENCES sets(id) ON DELETE CASCADE,
    CONSTRAINT fk_modules_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);
CREATE INDEX idx_modules_set_id              ON modules (set_id);
CREATE INDEX idx_modules_business_id         ON modules (business_id);
CREATE INDEX idx_modules_is_default          ON modules (set_id, is_default) WHERE is_default = TRUE;
CREATE INDEX idx_modules_service_template_id ON modules (service_template_id);
CREATE INDEX idx_modules_service_category_id ON modules (service_category_id);
CREATE INDEX idx_modules_deleted_at          ON modules (deleted_at);

CREATE TABLE mainline_instances (
    id          BIGSERIAL PRIMARY KEY,
    model_name  VARCHAR(100) NOT NULL,
    business_id BIGINT NOT NULL,
    parent_id   BIGINT,
    ref_id      VARCHAR(100) NOT NULL,
    name        VARCHAR(200) NOT NULL,
    path        LTREE NOT NULL,
    level       INTEGER NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    is_default  BOOLEAN NOT NULL DEFAULT FALSE,
    extra       JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ,
    CONSTRAINT fk_mainline_instances_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    CONSTRAINT fk_mainline_instances_parent FOREIGN KEY (parent_id) REFERENCES mainline_instances(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX idx_mainline_instances_model_ref ON mainline_instances (model_name, ref_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_mainline_instances_business_model_ref ON mainline_instances (business_id, model_name, ref_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_mainline_instances_business_id ON mainline_instances (business_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_mainline_instances_parent_id ON mainline_instances (parent_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_mainline_instances_path_gist ON mainline_instances USING GIST (path);
CREATE INDEX idx_mainline_instances_business_parent_sort ON mainline_instances (business_id, parent_id, sort_order, id) WHERE deleted_at IS NULL;

-- ============================================================
-- 主机 + 关系表
-- ============================================================
CREATE TABLE hosts (
    id                UUID PRIMARY KEY,
    display_id        BIGSERIAL NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at        TIMESTAMPTZ,
    tenant_id         UUID NOT NULL,
    created_by        UUID,
    updated_by        UUID,
    cloud_area_id     UUID REFERENCES cloud_areas(id) ON DELETE SET NULL,
    business_id       BIGINT,
    host_name         TEXT NOT NULL,
    primary_ip        INET NOT NULL,
    ip_addresses      INET[] DEFAULT '{}',
    cloud_vendor      TEXT,
    cloud_instance_id TEXT,
    cloud_region      TEXT,
    vpc_id            TEXT,
    subnet_id         TEXT,
    cpu               INTEGER,
    memory            INTEGER,
    disk_size         INTEGER,
    os_type           TEXT,
    os_version        TEXT,
    status            TEXT NOT NULL DEFAULT 'running',
    is_destroyed      BOOLEAN NOT NULL DEFAULT FALSE,
    cloud_metadata    JSONB,
    custom_fields     JSONB,
    CONSTRAINT chk_hosts_status       CHECK (status IN ('running', 'stopped', 'terminated')),
    CONSTRAINT chk_hosts_os_type      CHECK (os_type IS NULL OR os_type IN ('linux', 'windows')),
    CONSTRAINT chk_hosts_cloud_vendor CHECK (cloud_vendor IS NULL OR cloud_vendor IN ('aws', 'tencent_cloud', 'aliyun', 'custom'))
);
CREATE UNIQUE INDEX idx_hosts_display_id ON hosts (display_id);
CREATE INDEX idx_hosts_tenant_id         ON hosts (tenant_id);
CREATE INDEX idx_hosts_cloud_area_id     ON hosts (cloud_area_id);
CREATE INDEX idx_hosts_business_id       ON hosts (business_id) WHERE business_id IS NOT NULL;
CREATE INDEX idx_hosts_primary_ip        ON hosts (primary_ip);
CREATE INDEX idx_hosts_host_name         ON hosts (host_name);
CREATE INDEX idx_hosts_cloud_instance_id ON hosts (cloud_instance_id);
CREATE INDEX idx_hosts_status            ON hosts (status);
CREATE INDEX idx_hosts_is_destroyed      ON hosts (is_destroyed);
CREATE INDEX idx_hosts_cloud_vendor      ON hosts (cloud_vendor);
CREATE INDEX idx_hosts_vpc_id            ON hosts (vpc_id);
CREATE UNIQUE INDEX idx_hosts_cloud_area_ip ON hosts (cloud_area_id, primary_ip) WHERE deleted_at IS NULL AND is_destroyed = FALSE;
CREATE UNIQUE INDEX idx_hosts_cloud_instance ON hosts (cloud_vendor, cloud_instance_id) WHERE deleted_at IS NULL AND cloud_vendor IS NOT NULL AND cloud_instance_id IS NOT NULL;
CREATE INDEX idx_hosts_cloud_metadata ON hosts USING GIN (cloud_metadata);
CREATE INDEX idx_hosts_custom_fields  ON hosts USING GIN (custom_fields);

CREATE TABLE host_business_relations (
    host_id     UUID NOT NULL,
    business_id BIGINT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (host_id, business_id),
    CONSTRAINT fk_hbr_host FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE,
    CONSTRAINT fk_hbr_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);
CREATE INDEX idx_host_business_relations_business_id ON host_business_relations (business_id);

CREATE TABLE host_module_relations (
    host_id    UUID NOT NULL,
    module_id  BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (host_id, module_id),
    CONSTRAINT fk_hmr_host FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE
);
CREATE INDEX idx_host_module_relations_module_id ON host_module_relations (module_id);

-- ============================================================
-- 统一实例表(A 套,按 model_id LIST 分区;子分区运行期建)
-- ============================================================
CREATE TABLE model_instances (
    id          UUID NOT NULL DEFAULT gen_random_uuid(),
    model_id    UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    tenant_id   UUID NOT NULL,
    business_id BIGINT,
    properties  JSONB NOT NULL DEFAULT '{}',
    path        LTREE,
    created_by  UUID,
    updated_by  UUID,
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at  TIMESTAMPTZ,
    PRIMARY KEY (id, model_id)
) PARTITION BY LIST (model_id);
CREATE INDEX idx_model_instances_properties_gin ON model_instances USING GIN  (properties);
CREATE INDEX idx_model_instances_path_gist      ON model_instances USING GIST (path);
CREATE INDEX idx_model_instances_tenant         ON model_instances (tenant_id);
CREATE INDEX idx_model_instances_business       ON model_instances (business_id);
CREATE INDEX idx_model_instances_deleted        ON model_instances (deleted_at) WHERE deleted_at IS NULL;

-- ============================================================
-- 动态模型引擎(B 套:EAV + 关联 + 审计)
-- ============================================================
CREATE TABLE dynamic_models (
    id            BIGSERIAL PRIMARY KEY,
    uid           VARCHAR(50)  NOT NULL,
    name          VARCHAR(100) NOT NULL,
    is_paused     BOOLEAN NOT NULL DEFAULT FALSE,
    description   VARCHAR(500),
    icon          VARCHAR(50),
    unique_fields JSONB,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX idx_dynamic_models_uid ON dynamic_models (uid);

CREATE TABLE dynamic_attributes (
    id            BIGSERIAL PRIMARY KEY,
    model_uid     VARCHAR(50)  NOT NULL,
    field_uid     VARCHAR(50)  NOT NULL,
    field_name    VARCHAR(100) NOT NULL,
    field_type    VARCHAR(20)  NOT NULL,
    category      VARCHAR(20)  NOT NULL DEFAULT 'config',
    is_required   BOOLEAN NOT NULL DEFAULT FALSE,
    is_unique     BOOLEAN NOT NULL DEFAULT FALSE,
    unique_group  VARCHAR(50),
    is_read_only  BOOLEAN NOT NULL DEFAULT FALSE,
    default_value VARCHAR(500),
    placeholder   VARCHAR(200),
    unit          VARCHAR(20),
    validators    JSONB,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX idx_dynamic_attributes_model_field ON dynamic_attributes (model_uid, field_uid);

CREATE TABLE resources (
    id         BIGSERIAL PRIMARY KEY,
    model_uid  VARCHAR(50)  NOT NULL,
    name       VARCHAR(200) NOT NULL,
    configs    JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    cloud_id BIGINT      GENERATED ALWAYS AS ((configs->>'cloud_id')::bigint) STORED,
    inner_ip VARCHAR(50) GENERATED ALWAYS AS (configs->>'inner_ip')          STORED
) WITH (fillfactor = 80);
CREATE INDEX        idx_resources_model_uid   ON resources (model_uid);
CREATE INDEX        idx_resources_configs_gin ON resources USING GIN (configs);
CREATE UNIQUE INDEX idx_unique_host_ip        ON resources (cloud_id, inner_ip) WHERE model_uid = 'host' AND deleted_at IS NULL;

CREATE TABLE resource_states (
    resource_id     BIGINT PRIMARY KEY,
    last_check_time TIMESTAMPTZ,
    health_status   INTEGER NOT NULL DEFAULT 0,
    metrics         JSONB,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
) WITH (fillfactor = 70);
CREATE INDEX idx_resource_states_metrics_gin ON resource_states USING GIN (metrics);

CREATE TABLE association_types (
    id                  BIGSERIAL PRIMARY KEY,
    uid                 VARCHAR(50)  NOT NULL,
    name                VARCHAR(100) NOT NULL,
    source_to_dest_desc VARCHAR(100),
    dest_to_source_desc VARCHAR(100),
    is_builtin          BOOLEAN NOT NULL DEFAULT FALSE,
    description         VARCHAR(500),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX idx_association_types_uid ON association_types (uid);

CREATE TABLE model_associations (
    id               BIGSERIAL PRIMARY KEY,
    source_model_uid VARCHAR(50) NOT NULL,
    target_model_uid VARCHAR(50) NOT NULL,
    association_uid  VARCHAR(50) NOT NULL,
    mapping          VARCHAR(10) NOT NULL,
    on_delete        VARCHAR(20) DEFAULT 'restrict',
    description      VARCHAR(500),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX idx_unique_model_association ON model_associations (source_model_uid, target_model_uid, association_uid);
CREATE INDEX idx_model_associations_source_assoc ON model_associations (source_model_uid, association_uid);
CREATE INDEX idx_model_associations_target_assoc ON model_associations (target_model_uid, association_uid);

CREATE TABLE relations (
    id               BIGSERIAL PRIMARY KEY,
    source_id        BIGINT NOT NULL,
    target_id        BIGINT NOT NULL,
    association_uid  VARCHAR(50) NOT NULL,
    source_model_uid VARCHAR(50),
    target_model_uid VARCHAR(50),
    properties       JSONB,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_relations_source_assoc ON relations (source_id, association_uid);
CREATE INDEX idx_relations_target_assoc ON relations (target_id, association_uid);
CREATE INDEX idx_relations_models_assoc ON relations (source_model_uid, target_model_uid, association_uid);

CREATE TABLE resource_histories (
    id            BIGSERIAL PRIMARY KEY,
    resource_id   BIGINT      NOT NULL,
    model_uid     VARCHAR(50) NOT NULL,
    change_type   VARCHAR(20) NOT NULL,
    before_data   JSONB,
    after_data    JSONB,
    changed_by    VARCHAR(100),
    changed_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    client_ip     VARCHAR(50),
    user_agent    VARCHAR(500),
    resource_name VARCHAR(200) NOT NULL DEFAULT '',
    biz_name      VARCHAR(200) NOT NULL DEFAULT ''
);
CREATE INDEX idx_resource_histories_resource_time ON resource_histories (resource_id, changed_at DESC);
CREATE INDEX idx_resource_histories_changed_at    ON resource_histories (changed_at DESC);
CREATE INDEX idx_resource_histories_model_time    ON resource_histories (model_uid, changed_at DESC);
CREATE INDEX idx_resource_histories_biz           ON resource_histories ((COALESCE(after_data, before_data) ->> 'business_id'));

CREATE TABLE model_unique_rules (
    id                  BIGSERIAL PRIMARY KEY,
    model_uid           VARCHAR(50)  NOT NULL,
    name                VARCHAR(100) NOT NULL,
    is_default          BOOLEAN NOT NULL DEFAULT FALSE,
    is_auxiliary        BOOLEAN NOT NULL DEFAULT FALSE,
    enabled             BOOLEAN NOT NULL DEFAULT TRUE,
    ignore_if_all_empty BOOLEAN NOT NULL DEFAULT TRUE,
    description         VARCHAR(500),
    created_by          VARCHAR(100),
    updated_by          VARCHAR(100),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);
CREATE UNIQUE INDEX uk_model_unique_rules_default_active ON model_unique_rules (model_uid, is_default) WHERE is_default = TRUE AND deleted_at IS NULL;
CREATE UNIQUE INDEX uk_model_unique_rules_name_active    ON model_unique_rules (model_uid, name)       WHERE deleted_at IS NULL;
CREATE INDEX        idx_model_unique_rules_model         ON model_unique_rules (model_uid, enabled)    WHERE deleted_at IS NULL;

CREATE TABLE model_unique_rule_fields (
    id         BIGSERIAL PRIMARY KEY,
    rule_id    BIGINT      NOT NULL REFERENCES model_unique_rules(id) ON DELETE CASCADE,
    field_uid  VARCHAR(50) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX uk_model_unique_rule_fields         ON model_unique_rule_fields (rule_id, field_uid);
CREATE INDEX        idx_model_unique_rule_fields_rule_sort ON model_unique_rule_fields (rule_id, sort_order);

-- ============================================================
-- 服务 / 流程
-- ============================================================
CREATE TABLE service_categories (
    id          BIGSERIAL PRIMARY KEY,
    business_id BIGINT,
    name        VARCHAR(200) NOT NULL,
    parent_id   BIGINT,
    root_id     BIGINT NOT NULL,
    is_builtin  BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at  TIMESTAMPTZ
);
CREATE INDEX idx_service_categories_business_id ON service_categories (business_id);
CREATE INDEX idx_service_categories_parent_id   ON service_categories (parent_id);
CREATE INDEX idx_service_categories_root_id     ON service_categories (root_id);
CREATE INDEX idx_service_categories_deleted_at  ON service_categories (deleted_at);

CREATE TABLE service_templates (
    id           BIGSERIAL PRIMARY KEY,
    name         VARCHAR(200) NOT NULL,
    business_id  BIGINT NOT NULL,
    service_type VARCHAR(50),
    description  VARCHAR(500),
    created_by   VARCHAR(100),
    updated_by   VARCHAR(100),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at   TIMESTAMPTZ
);
CREATE INDEX idx_service_templates_business_id ON service_templates (business_id);
CREATE INDEX idx_service_templates_deleted_at  ON service_templates (deleted_at);

CREATE TABLE process_templates (
    id                  BIGSERIAL PRIMARY KEY,
    name                VARCHAR(200) NOT NULL,
    business_id         BIGINT NOT NULL,
    service_template_id BIGINT,
    start_command       VARCHAR(500),
    stop_command        VARCHAR(500),
    restart_command     VARCHAR(500),
    reload_command      VARCHAR(500),
    face_stop_command   VARCHAR(500),
    work_path           VARCHAR(500),
    pid_file            VARCHAR(500),
    "user"              VARCHAR(100),
    proc_num            INT NOT NULL DEFAULT 1,
    start_param_regex   VARCHAR(500),
    priority            INT NOT NULL DEFAULT 0,
    timeout             INT NOT NULL DEFAULT 60,
    auto_start          BOOLEAN NOT NULL DEFAULT TRUE,
    auto_recover        BOOLEAN NOT NULL DEFAULT TRUE,
    bind_info           JSONB,
    description         VARCHAR(500),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_process_templates_business_id         ON process_templates (business_id);
CREATE INDEX idx_process_templates_service_template_id ON process_templates (service_template_id);

CREATE TABLE processes (
    id                  BIGSERIAL PRIMARY KEY,
    process_template_id BIGINT NOT NULL,
    host_id             UUID NOT NULL,
    module_id           BIGINT NOT NULL,
    business_id         BIGINT NOT NULL,
    process_name        VARCHAR(200),
    bind_info           JSONB,
    start_command       VARCHAR(500),
    "user"              VARCHAR(100),
    work_path           VARCHAR(500),
    priority            INT,
    proc_num            INT,
    description         VARCHAR(500),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at          TIMESTAMPTZ
);
CREATE INDEX idx_processes_template_id ON processes (process_template_id);
CREATE INDEX idx_processes_host_id     ON processes (host_id);
CREATE INDEX idx_processes_module_id   ON processes (module_id);
CREATE INDEX idx_processes_business_id ON processes (business_id);
CREATE INDEX idx_processes_deleted_at  ON processes (deleted_at);

CREATE TABLE process_statuses (
    process_id    BIGINT PRIMARY KEY,
    host_id       UUID NOT NULL,
    pid           INT NOT NULL DEFAULT 0,
    status        VARCHAR(50),
    cpu           DOUBLE PRECISION NOT NULL DEFAULT 0,
    memory        DOUBLE PRECISION NOT NULL DEFAULT 0,
    start_time    TIMESTAMPTZ,
    last_check_at TIMESTAMPTZ,
    error_message VARCHAR(500)
);
CREATE INDEX idx_process_statuses_host_id ON process_statuses (host_id);

-- set_templates / set_template_service_bindings(活表,原缺迁移,此处补建)
CREATE TABLE set_templates (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(200) NOT NULL,
    business_id BIGINT NOT NULL,
    env_type    VARCHAR(50),
    description VARCHAR(500),
    created_by  VARCHAR(100),
    updated_by  VARCHAR(100),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at  TIMESTAMPTZ
);
CREATE INDEX idx_set_templates_business_id ON set_templates (business_id);
CREATE INDEX idx_set_templates_deleted_at  ON set_templates (deleted_at);

CREATE TABLE set_template_service_bindings (
    id                  BIGSERIAL PRIMARY KEY,
    set_template_id     BIGINT NOT NULL,
    service_template_id BIGINT NOT NULL,
    sort_order          INT NOT NULL DEFAULT 0
);
CREATE INDEX idx_stsb_set     ON set_template_service_bindings (set_template_id);
CREATE INDEX idx_stsb_service ON set_template_service_bindings (service_template_id);

-- ============================================================
-- 资源池
-- ============================================================
CREATE TABLE resource_directories (
    id          BIGSERIAL PRIMARY KEY,
    parent_id   BIGINT,
    name        VARCHAR(200) NOT NULL,
    description VARCHAR(500),
    path        VARCHAR(500),
    level       INTEGER NOT NULL DEFAULT 1,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    is_default  BOOLEAN NOT NULL DEFAULT FALSE,
    created_by  VARCHAR(100),
    updated_by  VARCHAR(100),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at  TIMESTAMPTZ
);
CREATE INDEX idx_resource_directories_parent_id ON resource_directories (parent_id);
CREATE INDEX idx_resource_directories_path      ON resource_directories (path);
CREATE INDEX idx_resource_directories_default   ON resource_directories (is_default);

CREATE TABLE resource_pool_hosts (
    host_id      UUID PRIMARY KEY,
    directory_id BIGINT NOT NULL,
    imported_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    imported_by  VARCHAR(100),
    remark       VARCHAR(500)
);
CREATE INDEX idx_resource_pool_hosts_directory_id ON resource_pool_hosts (directory_id);

-- ============================================================
-- auth
-- ============================================================
CREATE TABLE auth_users (
    id            UUID PRIMARY KEY,
    username      VARCHAR(64) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name  VARCHAR(128),
    status        VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMPTZ
);

CREATE TABLE auth_user_roles (
    user_id     UUID NOT NULL,
    role        VARCHAR(32) NOT NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role)
);
CREATE INDEX idx_auth_user_roles_user_id ON auth_user_roles (user_id);
CREATE INDEX idx_auth_user_roles_role    ON auth_user_roles (role);
