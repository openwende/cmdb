-- 回滚：将 hosts 表的 business_id 改回 UUID
-- 注意：这将丢失所有数据，因为类型不兼容

-- 删除索引
DROP INDEX IF EXISTS idx_hosts_business_id;

-- 修改字段类型回 UUID
ALTER TABLE hosts ALTER COLUMN business_id TYPE UUID USING NULL;

-- 重新创建外键约束
ALTER TABLE hosts ADD CONSTRAINT hosts_business_id_fkey 
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE SET NULL;

-- 重新创建索引
CREATE INDEX idx_hosts_business_id ON hosts (business_id) WHERE business_id IS NOT NULL;
