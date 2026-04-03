import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Select, Typography } from 'antd';
import { AssignType } from '@/pages/Resource/Types';
import { HostPoolStatus } from '@/pages/Resource/Types';
import { hostDirectoryMock } from '@/mock/resource';
import BusinessSelector from '@/components/common/BusinessSelector';
import './style.css';

const { Option } = Select;

interface AssignModalProps {
  assignType: AssignType;
  selectedRowKeys: React.Key[];
  hostPoolStatuses?: HostPoolStatus[];
  onClose: () => void;
}

const AssignModal: React.FC<AssignModalProps> = ({
  assignType,
  selectedRowKeys,
  hostPoolStatuses = [],
  onClose,
}) => {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<number | null>(null);

  const onOk = () => {
    // TODO: api
    // let payload = {};
    // if (assignType === AssignType.Biz) {
    //     payload = {
    //         bk_biz_id: selected,
    //         bk_host_id: selectedRowKeys
    //     }
    // } else {
    //     payload = {
    //         bk_module_id: selected,
    //         bk_host_id: selectedRowKeys
    //     }
    // }
    setSelected(null);
    onClose();
  };

  const onCancel = () => {
    setSelected(null);
    onClose();
  };

  // Exclude a directory if it already contains all hosts.
  const shouldDirExclude = (dirId: number) => {
    return hostPoolStatuses.every((it) => it.moduleId === dirId);
  };

  return (
    <Modal
      open={assignType !== AssignType.None}
      title={
        assignType === AssignType.Biz
          ? t('host.assign.modal.title.biz')
          : t('host.assign.modal.title.pool')
      }
      okText={t('host.assign.modal.ok')}
      cancelText={t('host.assign.modal.cancel')}
      maskClosable={false}
      closable={false}
      onOk={onOk}
      onCancel={onCancel}
      okButtonProps={{ disabled: !selected }}
      className="assign-modal"
    >
      <Typography.Text className="selected-tip">
        {t('host.assign.modal.selectedPrefix')}
        <span className="selected-count">{selectedRowKeys.length}</span>
        {t('host.assign.modal.selectedSuffix')}
      </Typography.Text>

      <div className="assign-target">
        <Typography.Text className="target-label">
          {assignType === AssignType.Biz
            ? t('host.assign.modal.text.biz')
            : t('host.assign.modal.text.pool')}
        </Typography.Text>

        {assignType === AssignType.Biz ? (
          <BusinessSelector value={selected} onChange={setSelected} allowClear={false} />
        ) : (
          <Select
            showSearch={true}
            value={selected}
            onChange={setSelected}
            style={{ width: '100%' }}
            placeholder={t('host.assign.modal.placeholder.pool')}
            filterOption={(input, option) =>
              (option?.children as any).toLowerCase().includes(input.toLowerCase())
            }
          >
            {hostDirectoryMock
              .filter((dir) => !shouldDirExclude(dir.bk_module_id))
              .map((dir) => (
                <Option key={dir.bk_module_id} value={dir.bk_module_id}>
                  {dir.bk_module_name}
                </Option>
              ))}
          </Select>
        )}
      </div>
    </Modal>
  );
};

export default AssignModal;
