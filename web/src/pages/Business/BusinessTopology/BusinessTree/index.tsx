import React, { useMemo, useState } from "react";
import { Input, Tree } from "antd";
import { businessData, idleCluster } from "../../../../mock/business";
import "./style.css";

interface Props {
    selectedKey: string | null;
    onSelect: (key: string | null) => void;
}

function buildTreeData() {
    return businessData.map(biz => ({
        title: biz.name,
        key: `business-${biz.id}`,
        children: [
            {
                title: idleCluster.name,
                key: `cluster-${idleCluster.id}-${biz.id}`,
                children: idleCluster.modules.map(mod => ({
                    title: mod.name,
                    key: `module-${mod.id}-${idleCluster.id}-${biz.id}`
                }))
            },
            ...biz.clusters.map(cluster => ({
                title: cluster.name,
                key: `cluster-${cluster.id}-${biz.id}`,
                children: cluster.modules.map(mod => ({
                    title: mod.name,
                    key: `module-${mod.id}-${cluster.id}-${biz.id}`
                }))
            }))
        ]
    }));
}

const BusinessTree: React.FC<Props> = ({ selectedKey, onSelect }) => {
    const [search, setSearch] = useState("");
    const treeData = useMemo(() => buildTreeData(), []);

    return (
        <div className="tree-wrapper">
            <div className="search-wrapper">
                <Input.Search
                    placeholder="请输入关键词"
                    allowClear
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ width: 240 }}
                />
            </div>
            <Tree
                treeData={treeData}
                defaultExpandAll={true}
                blockNode={true}
                onSelect={keys => onSelect(keys[0] as string)}
                selectedKeys={selectedKey ? [selectedKey] : []}
                className="ant-tree"
            />
        </div>

    );
};

export default BusinessTree;