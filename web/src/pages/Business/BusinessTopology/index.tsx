import React, { useState } from 'react';
import { Tabs } from 'antd';
import BusinessTree from './BusinessTree';
import HostList from './HostList';
import ServiceInstance from './ServiceInstance';
import NodeInfo from './NodeInfo';
import './style.css';

const BusinessTopology: React.FC = () => {
    const [activeTab, setActiveTab] = useState('hostList');
    const [selectedNode, setSelectedNode] = useState<any>(null);

    const items = [
        {
            key: 'hostList',
            label: '主机列表',
            children: <HostList selectedNode={selectedNode} />
        },
        {
            key: 'serviceInstance',
            label: '服务实例',
            children: <ServiceInstance selectedNode={selectedNode} />
        },
        {
            key: 'nodeInfo',
            label: '节点信息',
            children: <NodeInfo selectedNode={selectedNode} />
        }
    ];

    return (
        <div className='topology-wrapper'>
            <BusinessTree selectedKey={selectedNode} onSelect={setSelectedNode} />
            <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                items={items}
                className='topology-tabs'
            />
        </div>
    );
};

export default BusinessTopology;