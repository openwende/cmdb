import React from "react";
import { Drawer, Form, Input, Select, Button, Collapse } from "antd";

const { Option } = Select;
const { Panel } = Collapse;

interface DrawerProps {
    visible: boolean;
    type: "create" | "edit";
    onClose: () => void;
}

const ModifyDrawer: React.FC<DrawerProps> = ({ visible, type, onClose }) => {
    return (
        <Drawer
            title={type === "create" ? "创建 业务" : "批量编辑 业务"}
            placement="right"
            width={560}
            onClose={onClose}
            open={visible}
            destroyOnClose
            maskClosable
        >
            <div style={{ marginBottom: 16 }}>
                <a style={{ color: "#1976d2" }}>原性</a>
            </div>
            <Collapse defaultActiveKey={["base", "role"]} ghost>
                <Panel header="基础信息" key="base">
                    <Form layout="vertical">
                        <div style={{ display: "flex", gap: 16 }}>
                            <Form.Item label="业务名" required style={{ flex: 1 }}>
                                <Input placeholder="请输入业务名" />
                            </Form.Item>
                            <Form.Item label="生命周期" style={{ flex: 1 }}>
                                <Select defaultValue="已上线">
                                    <Option value="已上线">已上线</Option>
                                    <Option value="开发中">开发中</Option>
                                </Select>
                            </Form.Item>
                        </div>
                        <div style={{ display: "flex", gap: 16 }}>
                            <Form.Item label="时区" required style={{ flex: 1 }}>
                                <Select defaultValue="Asia/Shanghai">
                                    <Option value="Asia/Shanghai">Asia/Shanghai</Option>
                                </Select>
                            </Form.Item>
                            <Form.Item label="语言" required style={{ flex: 1 }}>
                                <Select defaultValue="中文">
                                    <Option value="中文">中文</Option>
                                    <Option value="英文">英文</Option>
                                </Select>
                            </Form.Item>
                        </div>
                    </Form>
                </Panel>
                <Panel header="角色" key="role">
                    <Form layout="vertical">
                        <div style={{ display: "flex", gap: 16 }}>
                            <Form.Item label="运维人员" required style={{ flex: 1 }}>
                                <Input placeholder="请输入运维人员" />
                            </Form.Item>
                            <Form.Item label="产品人员" style={{ flex: 1 }}>
                                <Input placeholder="请输入产品人员" />
                            </Form.Item>
                        </div>
                        <div style={{ display: "flex", gap: 16 }}>
                            <Form.Item label="测试人员" style={{ flex: 1 }}>
                                <Input placeholder="请输入测试人员" />
                            </Form.Item>
                            <Form.Item label="开发人员" style={{ flex: 1 }}>
                                <Input placeholder="请输入开发人员" />
                            </Form.Item>
                        </div>
                        <Form.Item label="操作人员" style={{ flex: 1 }}>
                            <Input placeholder="请输入操作人员" />
                        </Form.Item>
                    </Form>
                </Panel>
            </Collapse>
            <div style={{ marginTop: 24, textAlign: "left" }}>
                <Button type="primary" style={{ marginRight: 8 }}>提交</Button>
                <Button onClick={onClose}>取消</Button>
            </div>
        </Drawer>
    );
};

export default ModifyDrawer;