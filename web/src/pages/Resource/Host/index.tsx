import React, { useState } from "react";
import { Tabs } from "antd";
import Directory from "./Directory";
import HostList from "./HostList";
import { TabsKey, TabsProps } from "../Types";
import "./style.css";

const HostPage: React.FC = () => {
    const [tab, setTab] = useState(TabsKey.Unassigned);
    const [selectedDir, setSelectedDir] = useState<number | null>(null);

    const items: TabsProps[] = [
        {
            key: TabsKey.Unassigned,
            label: '未分配',
            children: <div className="unassigned-wrapper">
                    <Directory selectedId={selectedDir} onSelect={setSelectedDir} />
                <div style={{ flex: 1 }}>
                    <HostList />
                </div>
            </div>,
        },
        {
            key: TabsKey.Assigned,
            label: '已分配',
            children: <HostList />,
        },
        {
            key: TabsKey.All,
            label: '全部',
            children: <HostList />,
        },
    ];

    return (
        <div className="host-wrapper">
            <Tabs
                activeKey={tab}
                onChange={(key) => setTab(key as TabsKey)}
                tabBarGutter={32}
                items={items}
            />
        </div>
    );
};

export default HostPage;