import React from 'react';
import { Modal } from 'antd';
import './style.css';

interface ConfirmModalProps {
    visible: boolean;
    onOk: () => void;
    onCancel: () => void;
    width?: number;
    title?: string;
    description?: string;
    okText?: string;
    cancelText?: string;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
    visible,
    onOk,
    onCancel,
    width = 400,
    title = '确认离开当前页？',
    description = '离开将会导致未保存信息丢失',
    okText = '离开',
    cancelText = '取消'
}) => {
    return (
        <Modal
            title={null}
            width={width}
            open={visible}
            okText={okText}
            cancelText={cancelText}
            maskClosable={false}
            onOk={onOk}
            onCancel={onCancel}
            className='confirm-modal'
        >
            <p className='confirm-title'>{title}</p>
            {description && <p className='confirm-desc'>{description}</p>}
        </Modal>
    );
};

export default ConfirmModal;