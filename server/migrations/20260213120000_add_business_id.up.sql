-- 为 businesses 表添加 business_id 字段
ALTER TABLE businesses ADD COLUMN business_id BIGINT;

-- 创建唯一索引，确保 business_id 在租户内唯一
CREATE UNIQUE INDEX idx_businesses_business_id_tenant ON businesses (business_id, tenant_id) WHERE deleted_at IS NULL AND business_id IS NOT NULL;

-- 创建索引便于查询
CREATE INDEX idx_businesses_business_id ON businesses (business_id) WHERE business_id IS NOT NULL;
