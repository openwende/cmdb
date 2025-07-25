import React from 'react';
import { Collapse } from 'antd';
import { bizNodeInfo } from '@/mock/business';
import InfoItem from '../InfoItem';
import { TreeData } from '../../../Types';
import './style.css';

interface Props {
    selectedNode: TreeData;
}

const BusinessNodeInfo: React.FC<Props> = ({ selectedNode }) => {
    const bizData = bizNodeInfo[0];

    return (
        <>
            <Collapse
                defaultActiveKey={['1', '2']}
                ghost
                items={[
                    {
                        key: '1',
                        label: <span style={{ fontWeight: 'bold', color: '#000' }}>基础信息</span>,
                        children: (
                            <div className="info-grid">
                                <InfoItem label="ID" value={bizData.bk_biz_id} />
                                <InfoItem label="业务名" value={bizData.bk_biz_name} />
                                <InfoItem label="创建时间" value={new Date(bizData.create_time).toLocaleString()} />
                                <InfoItem label="创建人" value={bizData.bk_created_by} />
                                <InfoItem label="更新时间" value={new Date(bizData.last_time).toLocaleString()} />
                                <InfoItem label="更新人" value={bizData.bk_updated_by} />
                                <InfoItem label="生命周期" value={bizData.life_cycle === "2" ? "已上线" : "测试中"} />
                                <InfoItem label="时区" value={bizData.time_zone} />
                                <InfoItem label="语言" value={bizData.language === "1" ? "中文" : "英文"} />
                            </div>
                        )
                    },
                    {
                        key: '2',
                        label: <span style={{ fontWeight: 'bold', color: '#000' }}>角色</span>,
                        children: (
                            <div className="info-grid">
                                <InfoItem label="运维人员" value={bizData.bk_biz_maintainer} />
                                <InfoItem label="产品人员" value={bizData.bk_biz_productor} />
                                <InfoItem label="测试人员" value={bizData.bk_biz_tester} />
                                <InfoItem label="开发人员" value={bizData.bk_biz_developer} />
                                <InfoItem label="操作人员" value={bizData.operator} />
                            </div>
                        )
                    }
                ]}
            />
        </>
    );
};

export default BusinessNodeInfo;
