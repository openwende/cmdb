import React, { useState, useEffect } from "react";
import BusinessTree from "./BusinessTree";
import HostTable from "./HostTable";
import { allHosts, businessData, idleCluster } from "../../../mock/business";

// 解析选中key
const parseSelected = (key: string | null) => {
    if (!key) return null;
    const arr = key.split("-");
    if (arr[0] === "business") {
        return { type: "business", businessId: arr[1] };
    }
    if (arr[0] === "cluster") {
        return { type: "cluster", clusterId: arr[1], businessId: arr[2] };
    }
    if (arr[0] === "module") {
        return { type: "module", moduleId: arr[1], clusterId: arr[2], businessId: arr[3] };
    }
    return null;
};

// 辅助函数：获取业务下所有集群和模块id
function getAllClusterAndModuleIdsOfBusiness(businessId: string) {
    // 找到业务
    const biz = businessData.find(b => b.id === businessId);
    if (!biz) return { clusterIds: [], moduleIds: [] };
    // 普通集群
    const clusterIds = biz.clusters.map(c => c.id);
    const moduleIds = biz.clusters.flatMap(c => c.modules.map(m => m.id));
    // 空闲机池
    clusterIds.push(idleCluster.id);
    moduleIds.push(...idleCluster.modules.map(m => m.id));
    return { clusterIds, moduleIds };
}

// 辅助函数：获取集群下所有模块id
function getAllModuleIdsOfCluster(businessId: string, clusterId?: string) {
    if (clusterId === idleCluster.id) {
        return idleCluster.modules.map(m => m.id);
    }
    const biz = businessData.find(b => b.id === businessId);
    if (!biz) return [];
    const cluster = biz.clusters.find(c => c.id === clusterId);
    if (!cluster) return [];
    return cluster.modules.map(m => m.id);
}

const BusinessTopology: React.FC = () => {
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const [filteredHosts, setFilteredHosts] = useState<any[]>([]);

    // useEffect 筛选主机
    useEffect(() => {
        if (!selectedKey) {
            setFilteredHosts([]);
            return;
        }
        const info = parseSelected(selectedKey);
        let hosts: any[] = [];
        if (!info) {
            setFilteredHosts([]);
            return;
        }
        if (info.type === "business") {
            // 该业务下所有集群、所有模块的主机
            const { clusterIds, moduleIds } = getAllClusterAndModuleIdsOfBusiness(info.businessId);
            hosts = allHosts.filter(
                h => h.businessId === info.businessId &&
                    clusterIds.includes(h.clusterId) &&
                    moduleIds.includes(h.moduleId)
            );
        } else if (info.type === "cluster") {
            // 该集群下所有模块的主机
            const moduleIds = getAllModuleIdsOfCluster(info.businessId, info.clusterId);
            hosts = allHosts.filter(
                h => h.businessId === info.businessId &&
                    h.clusterId === info.clusterId &&
                    moduleIds.includes(h.moduleId)
            );
        } else if (info.type === "module") {
            // 该模块下主机
            hosts = allHosts.filter(
                h =>
                    h.businessId === info.businessId &&
                    h.clusterId === info.clusterId &&
                    h.moduleId === info.moduleId
            );
        }
        setFilteredHosts(hosts);
    }, [selectedKey]);

    return (
        <div style={{ display: "flex", height: "calc(100vh - 100px)" }}>
            <BusinessTree selectedKey={selectedKey} onSelect={setSelectedKey} />
            <div style={{ flex: 1, background: "#fff", padding: 16 }}>
                <HostTable hosts={filteredHosts} />
            </div>
        </div>
    );
};

export default BusinessTopology;