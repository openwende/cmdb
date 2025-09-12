import React, { useState } from 'react';
import { Modal, Select, Button } from 'antd';
import { useTranslation } from 'react-i18next';
import { resourceDir } from '@/mock/business';
import './style.css';

interface ReleaseHostModalProps {
    visible: boolean;
    selectedCount: number;
    onClose: () => void;
    onConfirm: (dirId: number) => void;
}

const ReleaseHostModal: React.FC<ReleaseHostModalProps> = ({ visible, selectedCount, onClose, onConfirm }) => {
    const { t } = useTranslation();
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
            title={<div className="release-modal-title">{t('business.topology.releaseHostModal.title')}</div>}
            onCancel={handleClose}
            footer={null}
            centered
            width={480}
            maskClosable={false}
            className="release-host-modal"
        >
            <div className="release-modal-desc">
                {t('business.topology.releaseHostModal.confirmMessage', { count: selectedCount })}<br />
                {t('business.topology.releaseHostModal.warning')}
            </div>
            <div className="release-modal-select-wrapper">
                <div className="release-modal-select-label">{t('business.topology.releaseHostModal.selectDirectory')}</div>
                <Select
                    className="release-modal-select"
                    placeholder={t('common.pleaseSelect')}
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
                    {t('common.cancel')}
                </Button>
                <Button type="primary" onClick={handleOk} disabled={selectedDir === null}>
                    {t('common.confirm')}
                </Button>
            </div>
        </Modal>
    );
};

export default ReleaseHostModal;
