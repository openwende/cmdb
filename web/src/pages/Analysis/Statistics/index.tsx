import React from "react";
import { Divider } from "antd";
import Overview from "./Overview";
import Host from "./Host";
import Instance from "./Instance";
import "./style.css";

const Statistics: React.FC = () => {
    return (
        <div className="statistics-container">
            <Overview />
            <Divider />
            <Host />
            <Divider />
            <Instance />
        </div>
    );
};

export default Statistics;