-- 回滚：删除 business_id 字段
DROP INDEX IF EXISTS idx_businesses_business_id;
DROP INDEX IF EXISTS idx_businesses_business_id_tenant;
ALTER TABLE businesses DROP COLUMN IF EXISTS business_id;
