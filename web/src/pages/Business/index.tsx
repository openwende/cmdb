import React, { useState, useEffect } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { Tabs, Card } from "antd";
import BusinessTopology from "./BusinessTopology";
import ServiceTemplate from "./ServiceTemplate";

interface SubNavigation {
    tab: string;
    key: number;
    path: string;
    element: React.ReactNode;
}

const businessNavigation: SubNavigation[] = [
    {
        tab: '业务拓扑',
        key: 1,
        path: '/topology',
        element: <BusinessTopology />
    },
    {
        tab: '服务模板',
        key: 2,
        path: '/template',
        element: <ServiceTemplate />
    }
]

const { TabPane} = Tabs;
const Business:React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [activeTabKey, setActiveTabKey] = useState<number>(1);

    useEffect(() => {
        const path = location.pathname;
        if (path.includes('/topology')) {
            setActiveTabKey(1);
        } else if (path.includes('/template')) {
            setActiveTabKey(2)
        } else {
            setActiveTabKey(1)
        }
    }, [location.pathname]);

    const handleTabChange = (key: number) => {
        setActiveTabKey(key);

        switch (key) {
            case 1: 
                navigate('/business/topology');
                break;
            case 2:
                navigate('/business/template');
                break;
            default:
                navigate('/business/topology');
                break;
        }
    }
    
    return (
        <div>
            
        </div>
    )
}

export default Business;