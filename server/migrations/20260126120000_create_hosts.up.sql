-- 创建云区域表（Cloud Areas，类似蓝鲸CMDB的云区域）
CREATE TABLE IF NOT EXISTS cloud_areas (
    -- 基础字段
    id UUID PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    tenant_id UUID NOT NULL,

    -- 核心字段
    name TEXT NOT NULL,                      -- 云区域名称（如：直连区域、AWS-美东、腾讯云-广州）
    identifier TEXT NOT NULL,                -- 唯一标识符
    type TEXT DEFAULT 'direct',              -- 类型：direct（直连）、vpc、custom
    description TEXT,                        -- 描述

    -- 云平台信息（可选）
    cloud_vendor TEXT,                       -- 云厂商：aws、tencent_cloud、aliyun、custom
    vpc_id TEXT,                             -- VPC ID（如果是VPC类型）
    cidr_block TEXT,                         -- CIDR 地址块（如：10.0.0.0/16）
    region TEXT,                             -- 区域（如：us-east-1、ap-guangzhou）

    -- JSONB 扩展字段
    cloud_metadata JSONB,                    -- 云平台元数据
    custom_fields JSONB                      -- 自定义字段
);

-- 云区域索引
CREATE UNIQUE INDEX idx_cloud_areas_identifier_tenant
    ON cloud_areas (identifier, tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_cloud_areas_tenant_id ON cloud_areas (tenant_id);
CREATE INDEX idx_cloud_areas_cloud_vendor ON cloud_areas (cloud_vendor);
CREATE INDEX idx_cloud_areas_region ON cloud_areas (region);
CREATE INDEX idx_cloud_areas_vpc_id ON cloud_areas (vpc_id);
CREATE INDEX idx_cloud_areas_cloud_metadata ON cloud_areas USING GIN (cloud_metadata);
CREATE INDEX idx_cloud_areas_custom_fields ON cloud_areas USING GIN (custom_fields);

-- 云区域类型约束
ALTER TABLE cloud_areas ADD CONSTRAINT chk_cloud_areas_type
    CHECK (type IN ('direct', 'vpc', 'custom'));

-- 创建云主机表
CREATE TABLE IF NOT EXISTS hosts (
    -- 基础字段
    id UUID PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    tenant_id UUID NOT NULL,
    created_by UUID,
    updated_by UUID,

    -- 核心维度1：云区域（用于IP隔离，类似蓝鲸的bk_cloud_id）
    cloud_area_id UUID REFERENCES cloud_areas(id) ON DELETE SET NULL,

    -- 核心维度2：业务归属（NULL = 资源池）
    business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,

    -- 核心字段
    host_name TEXT NOT NULL,                 -- 主机名
    primary_ip INET NOT NULL,                -- 主IP地址
    ip_addresses INET[] DEFAULT '{}',        -- 所有IP地址列表

    -- 云平台相关（可选，用于云同步）
    cloud_vendor TEXT,                       -- 云厂商：aws、tencent_cloud、aliyun、custom（自建）
    cloud_instance_id TEXT,                  -- 云实例ID（如：i-abc123）
    cloud_region TEXT,                       -- 云区域
    vpc_id TEXT,                             -- VPC ID（冗余存储）
    subnet_id TEXT,                          -- 子网ID

    -- 硬件配置
    cpu INTEGER,                             -- CPU核数
    memory INTEGER,                          -- 内存（MB）
    disk_size INTEGER,                       -- 磁盘大小（GB）
    os_type TEXT,                            -- 操作系统类型：linux、windows
    os_version TEXT,                         -- 操作系统版本

    -- 状态和生命周期
    status TEXT NOT NULL DEFAULT 'running',  -- 状态：running、stopped、terminated
    is_destroyed BOOLEAN NOT NULL DEFAULT FALSE, -- 是否已销毁（标记删除）

    -- JSONB 扩展字段
    cloud_metadata JSONB,                    -- 云平台特有信息（云同步填充）
    custom_fields JSONB                      -- 业务自定义字段（如：部门、负责人、用途等）
);

-- 主机表索引
CREATE INDEX idx_hosts_tenant_id ON hosts (tenant_id);
CREATE INDEX idx_hosts_cloud_area_id ON hosts (cloud_area_id);
CREATE INDEX idx_hosts_business_id ON hosts (business_id);
CREATE INDEX idx_hosts_primary_ip ON hosts (primary_ip);
CREATE INDEX idx_hosts_host_name ON hosts (host_name);
CREATE INDEX idx_hosts_cloud_instance_id ON hosts (cloud_instance_id);
CREATE INDEX idx_hosts_status ON hosts (status);
CREATE INDEX idx_hosts_is_destroyed ON hosts (is_destroyed);
CREATE INDEX idx_hosts_cloud_vendor ON hosts (cloud_vendor);
CREATE INDEX idx_hosts_vpc_id ON hosts (vpc_id);

-- IP唯一性约束：同一云区域内IP唯一（类似蓝鲸的 bk_cloud_id + bk_host_innerip）
-- 排除已销毁和已软删除的记录
CREATE UNIQUE INDEX idx_hosts_cloud_area_ip
    ON hosts (cloud_area_id, primary_ip)
    WHERE deleted_at IS NULL AND is_destroyed = FALSE;

-- 云平台标识唯一性（为云同步预留）
-- 同一云厂商下，云实例ID唯一（排除已软删除的记录）
CREATE UNIQUE INDEX idx_hosts_cloud_instance
    ON hosts (cloud_vendor, cloud_instance_id)
    WHERE deleted_at IS NULL AND cloud_vendor IS NOT NULL AND cloud_instance_id IS NOT NULL;

-- JSONB 索引（支持高效查询自定义字段）
CREATE INDEX idx_hosts_cloud_metadata ON hosts USING GIN (cloud_metadata);
CREATE INDEX idx_hosts_custom_fields ON hosts USING GIN (custom_fields);

-- 添加约束检查
ALTER TABLE hosts ADD CONSTRAINT chk_hosts_status
    CHECK (status IN ('running', 'stopped', 'terminated'));
ALTER TABLE hosts ADD CONSTRAINT chk_hosts_os_type
    CHECK (os_type IS NULL OR os_type IN ('linux', 'windows'));
ALTER TABLE hosts ADD CONSTRAINT chk_hosts_cloud_vendor
    CHECK (cloud_vendor IS NULL OR cloud_vendor IN ('aws', 'tencent_cloud', 'aliyun', 'custom'));

-- 插入默认云区域（直连区域，类似蓝鲸的 bk_cloud_id=0）
INSERT INTO cloud_areas (
    id,
    tenant_id,
    name,
    identifier,
    type,
    description,
    created_at,
    updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000000',
    '直连区域',
    'default',
    'direct',
    '默认直连区域，用于非云环境的主机',
    NOW(),
    NOW()
) ON CONFLICT DO NOTHING;
