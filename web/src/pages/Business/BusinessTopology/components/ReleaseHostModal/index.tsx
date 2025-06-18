import React, { useState } from 'react';
import { Modal, Select, Button } from 'antd';
import { resourceDir } from '@/mock/business';
import './style.css';

interface ReleaseHostModalProps {
    visible: boolean;
    selectedCount: number;
    onClose: () => void;
    onConfirm: (dirId: number) => void;
}

const ReleaseHostModal: React.FC<ReleaseHostModalProps> = ({ visible, selectedCount, onClose, onConfirm }) => {
    const [selectedDir, setSelectedDir] = useState<number | null>(null);

    const handleChange = (value: number) => {
        setSelectedDir(value);
    };

    const handleOk = () => {
        if (selectedDir !== null) {
            onConfirm(selectedDir);
        }
    };

    const handleClose = () => {
        setSelectedDir(null);
        onClose();
    }

    return (
        <Modal
            open={visible}
            title={<div className="release-modal-title">确认归还主机池</div>}
            onCancel={handleClose}
            footer={null}
            centered
            width={480}
            maskClosable={false}
            className="release-host-modal"
        >
            <div className="release-modal-desc">
                确认将 <span className="release-modal-count">{selectedCount}</span> 台空闲机池转移到主机池？<br />
                请务必确认业务进程已停止或主机处于关机状态
            </div>
            <div className="release-modal-select-wrapper">
                <div className="release-modal-select-label">归还至目录</div>
                <Select
                    className="release-modal-select"
                    placeholder="请选择"
                    style={{ width: 310 }}
                    value={selectedDir}
                    onChange={handleChange}
                    options={resourceDir.info.map(item => ({
                        value: item.bk_module_id,
                        label: item.bk_module_name
                    }))}
                />
            </div>
            <div className="release-modal-footer">
                <Button onClick={handleClose} style={{ marginRight: 8 }}>
                    取消
                </Button>
                <Button type="primary" onClick={handleOk} disabled={selectedDir === null}>
                    确定
                </Button>
            </div>
        </Modal>
    );
};

export default ReleaseHostModal;
