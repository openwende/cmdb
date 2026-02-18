-- 修改 hosts 表的 business_id 字段类型从 UUID 改为 BIGINT
-- 首先删除外键约束（如果存在）
ALTER TABLE hosts DROP CONSTRAINT IF EXISTS hosts_business_id_fkey;

-- 修改字段类型
ALTER TABLE hosts ALTER COLUMN business_id TYPE BIGINT USING NULL;

-- 更新索引
DROP INDEX IF EXISTS idx_hosts_business_id;
CREATE INDEX idx_hosts_business_id ON hosts (business_id) WHERE business_id IS NOT NULL;
