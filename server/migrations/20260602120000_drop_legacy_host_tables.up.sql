-- 阶段2-S4：退役旧三表。
-- host 归属已全部收敛到 host_node_memberships（读 里程碑2 / 写 S2 / 撤双写安全网 S3），
-- 旧三表已无任何运行期读写，DROP 之。详见 docs/P1-host-membership-convergence.md §6/§7。
DROP TABLE IF EXISTS host_module_relations;
DROP TABLE IF EXISTS host_business_relations;
DROP TABLE IF EXISTS resource_pool_hosts;
