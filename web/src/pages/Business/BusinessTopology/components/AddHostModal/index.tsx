import React, { useState } from 'react';
import { Modal, Radio, Table, Button, Input, Tag, message } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import BusinessTreeComponent from '../TopologyTree';
import { allHosts2 } from '@/mock/business';

interface Props {
    visible: boolean;
    onClose: () => void;
    onConfirm: (hosts: any[]) => void;
}

interface HostData {
    bk_host_id: number;
    bk_host_innerip: string;
    bk_host_innerip_v6?: string;
    bk_cloud_id: any[];
}

const AddHostModal: React.FC<Props> = ({ visible, onClose, onConfirm }) => {
    const [mode, setMode] = useState<'static' | 'custom'>('static');
    const [selectedTreeKey, setSelectedTreeKey] = useState<string | null>(null);
    const [selectedHosts, setSelectedHosts] = useState<React.Key[]>([]);
    const [customInput, setCustomInput] = useState<string>('');
    const [customHosts, setCustomHosts] = useState<HostData[]>([]);

    // 表格列定义
    const columns = [
        {
            title: '内网IP',
            dataIndex: 'bk_host_innerip',
            key: 'bk_host_innerip'
        },
        {
            title: '内网IPv6',
            dataIndex: 'bk_host_innerip_v6',
            key: 'bk_host_innerip_v6',
            render: (text: string) => text || '--'
        },
        {
            title: '管控区域',
            dataIndex: 'bk_cloud_id',
            key: 'bk_cloud_id',
            render: (cloudInfo: any[]) => {
                return cloudInfo.length > 0
                    ? `${cloudInfo[0].bk_inst_name}[${cloudInfo[0].bk_inst_id}]`
                    : '--';
            }
        }
    ];

    // 获取当前显示的主机数据
    const getCurrentHosts = () => {
        if (mode === 'static') {
            return allHosts2.map(item => ({
                ...item.host,
                key: item.host.bk_host_id
            }));
        } else {
            return customHosts.map(host => ({
                ...host,
                key: host.bk_host_id
            }));
        }
    };

    // 处理自定义输入添加主机
    const handleAddCustomHosts = () => {
        if (!customInput.trim()) {
            message.warning('请输入主机IP');
            return;
        }

        const ips = customInput.split('\n').filter(ip => ip.trim());
        const newHosts: HostData[] = [];
        const existingIps = new Set(customHosts.map(h => h.bk_host_innerip));

        ips.forEach((ip, index) => {
            const trimmedIp = ip.trim();
            if (trimmedIp && !existingIps.has(trimmedIp)) {
                newHosts.push({
                    bk_host_id: Date.now() + index,
                    bk_host_innerip: trimmedIp,
                    bk_host_innerip_v6: '',
                    bk_cloud_id: [{
                        id: "90000001",
                        bk_obj_id: "plat",
                        bk_obj_icon: "",
                        bk_inst_id: 90000001,
                        bk_obj_name: "",
                        bk_inst_name: "未分配"
                    }]
                });
            }
        });

        if (newHosts.length > 0) {
            const updatedHosts = [...customHosts, ...newHosts];
            setCustomHosts(updatedHosts);
            // 自动选中新添加的主机
            const newSelectedKeys = [...selectedHosts, ...newHosts.map(h => h.bk_host_id)];
            setSelectedHosts(newSelectedKeys);
            setCustomInput('');
            message.success(`成功添加 ${newHosts.length} 台主机`);
        } else {
            message.warning('没有新的主机可添加');
        }
    };

    // 移除选中的主机
    const handleRemoveHost = (hostId: React.Key) => {
        if (mode === 'static') {
            setSelectedHosts(prev => prev.filter(id => id !== hostId));
        } else {
            setCustomHosts(prev => prev.filter(h => h.bk_host_id !== hostId));
            setSelectedHosts(prev => prev.filter(id => id !== hostId));
        }
    };

    // 获取已选择的主机标签
    const getSelectedHostTags = () => {
        const currentHosts = getCurrentHosts();
        return selectedHosts.map(hostId => {
            const host = currentHosts.find(h => h.key === hostId);
            if (host) {
                return (
                    <Tag
                        key={hostId}
                        closable
                        onClose={() => handleRemoveHost(hostId)}
                        icon={<CloseOutlined />}
                    >
                        {host.bk_host_innerip}
                    </Tag>
                );
            }
            return null;
        }).filter(Boolean);
    };

    const handleConfirm = () => {
        const currentHosts = getCurrentHosts();
        const selectedHostData = selectedHosts.map(hostId => 
            currentHosts.find(h => h.key === hostId)
        ).filter(Boolean);
        
        onConfirm(selectedHostData);
        handleCancel();
    };

    const handleCancel = () => {
        setMode('static');
        setSelectedTreeKey(null);
        setSelectedHosts([]);
        setCustomInput('');
        setCustomHosts([]);
        onClose();
    };

    return (
        <Modal
            title="新增主机到模块"
            open={visible}
            onCancel={handleCancel}
            width={1200}
            footer={[
                <Button key="cancel" onClick={handleCancel}>
                    取消
                </Button>,
                <Button key="confirm" type="primary" onClick={handleConfirm}>
                    下一步
                </Button>
            ]}
        >
            <div style={{ display: 'flex', gap: 16 }}>
                {/* 左侧内容 */}
                <div style={{ flex: 1 }}>
                    {/* 模式选择 */}
                    <Radio.Group 
                        value={mode} 
                        onChange={(e) => setMode(e.target.value)}
                        style={{ marginBottom: 16 }}
                    >
                        <Radio.Button value="static">静态拓扑</Radio.Button>
                        <Radio.Button value="custom">自定义输入</Radio.Button>
                    </Radio.Group>

                    {mode === 'static' ? (
                        // 静态拓扑模式
                        <BusinessTreeComponent
                            selectedKey={selectedTreeKey}
                            onSelect={(key) => setSelectedTreeKey(key)}
                            style={{ height: 400, overflow: 'auto', border: '1px solid #d9d9d9', padding: 8 }}
                        />
                    ) : (
                        // 自定义输入模式
                        <div>
                            <Input.TextArea
                                value={customInput}
                                onChange={(e) => setCustomInput(e.target.value)}
                                placeholder="请输入主机IP，多个IP请换行分隔"
                                rows={10}
                                style={{ marginBottom: 8 }}
                            />
                            <div style={{ color: '#666', fontSize: 12, marginBottom: 8 }}>
                                IP不正确或主机不存在
                            </div>
                            <Button 
                                type="primary" 
                                onClick={handleAddCustomHosts}
                                style={{ width: '100%' }}
                            >
                                添加至列表
                            </Button>
                        </div>
                    )}
                </div>

                {/* 右侧内容 */}
                <div style={{ flex: 1 }}>
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ marginBottom: 8 }}>结果预览</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span>已选择 1 台主机</span>
                            <Button type="link" size="small">
                                复制IP
                            </Button>
                            <Button type="link" size="small">
                                移除所有
                            </Button>
                        </div>
                        <div style={{ marginTop: 8, minHeight: 32, border: '1px solid #d9d9d9', padding: 8 }}>
                            {getSelectedHostTags()}
                        </div>
                    </div>

                    <Input.Search
                        placeholder="请输入"
                        style={{ marginBottom: 16 }}
                    />

                    <Table
                        rowSelection={{
                            selectedRowKeys: selectedHosts,
                            onChange: setSelectedHosts
                        }}
                        columns={columns}
                        dataSource={getCurrentHosts()}
                        rowKey="key"
                        pagination={{
                            pageSize: 10,
                            showSizeChanger: true,
                            showQuickJumper: true,
                            showTotal: (_, range) => 
                                `每页 ${range[1] - range[0] + 1} 条 共计 1 条`
                        }}
                        size="small"
                    />
                </div>
            </div>
        </Modal>
    );
};

export default AddHostModal;
