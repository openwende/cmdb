import React, { useState } from "react";
import { Outlet, useMatch } from "react-router-dom";
import { Tabs } from "antd";
import { useTranslation } from "react-i18next";
import Directory, { unmodifiableDirIds } from "./Directory";
import HostList, { deleteHistoryPath } from "./HostList";
import { TabsKey, TabsProps } from "../Types";
import "./style.css";

const HostPage: React.FC = () => {
    const { t } = useTranslation();
    const isDeleteHistoryRoute = useMatch(deleteHistoryPath);
    const [tab, setTab] = useState(TabsKey.Unassigned);
    const [selectedId, setSelectedId] = useState<number>(unmodifiableDirIds[0]);

    const items: TabsProps[] = [
        {
            key: TabsKey.Unassigned,
            label: t('resource.host.tabs.unassigned'),
            children: <div className="unassigned-wrapper">
                <Directory selectedId={selectedId} onSelect={setSelectedId} />
                <div style={{ flex: 1 }}>
                    <HostList selectedId={selectedId} tabKey={TabsKey.Unassigned} />
                </div>
            </div>,
        },
        {
            key: TabsKey.Assigned,
            label: t('resource.host.tabs.assigned'),
            children: <HostList tabKey={TabsKey.Assigned} />,
        },
        {
            key: TabsKey.All,
            label: t('resource.host.tabs.all'),
            children: <HostList tabKey={TabsKey.All} />,
        },
    ];

    return (
        <>
            {
                isDeleteHistoryRoute ? <Outlet /> : (
                    <div className="host-wrapper">
                        <Tabs
                            activeKey={tab}
                            onChange={(key) => setTab(key as TabsKey)}
                            tabBarGutter={32}
                            destroyOnHidden
                            items={items}
                        />
                    </div>
                )
            }
        </>

    );
};

export default HostPage;