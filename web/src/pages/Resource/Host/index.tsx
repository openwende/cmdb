import React, { useState } from "react";
import { Tabs } from "antd";
import Directory, { unmodifiableDirIds } from "./Directory";
import HostList from "./HostList";
import { TabsKey, TabsProps } from "../Types";
import "./style.css";

const HostPage: React.FC = () => {
    const [tab, setTab] = useState(TabsKey.Unassigned);
    const [selectedId, setSelectedId] = useState<number>(unmodifiableDirIds[0]);

    const items: TabsProps[] = [
        {
            key: TabsKey.Unassigned,
            label: '未分配',
            children: <div className="unassigned-wrapper">
                    <Directory selectedId={selectedId} onSelect={setSelectedId} />
                <div style={{ flex: 1 }}>
                    <HostList selectedId={selectedId} tabKey={TabsKey.Unassigned} />
                </div>
            </div>,
        },
        {
            key: TabsKey.Assigned,
            label: '已分配',
            children: <HostList tabKey={TabsKey.Assigned} />,
        },
        {
            key: TabsKey.All,
            label: '全部',
            children: <HostList tabKey={TabsKey.All} />,
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