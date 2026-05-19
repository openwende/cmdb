import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Select, Typography } from 'antd';
import { AssignType } from '@/pages/Resource/Types';
import { HostPoolStatus } from '@/pages/Resource/Types';
import BusinessSelector from '@/components/common/BusinessSelector';
import { useDirectoryStore } from '@/store/DirectoryStore';
import { useAppMessage } from '@/utils/message';
import { addHostsToPoolDirectory, assignHostsToBusinessIdlePool } from '@/api/services/resource';
import './style.css';

interface AssignModalProps {
  assignType: AssignType;
  selectedRowKeys: React.Key[];
  hostPoolStatuses?: HostPoolStatus[];
  onClose: () => void;
  onSuccess?: (type: AssignType) => void;
}

const AssignModal: React.FC<AssignModalProps> = ({
  assignType,
  selectedRowKeys,
  hostPoolStatuses = [],
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const message = useAppMessage();
  const [selected, setSelected] = useState<string | number | null>(null);
  const [loading, setLoading] = useState(false);
  const { directories, loading: dirLoading, fetchDirectories } = useDirectoryStore();

  useEffect(() => {
    if (assignType === AssignType.HostPool && directories.length === 0 && !dirLoading) {
      void fetchDirectories();
    }
  }, [assignType, directories.length, fetchDirectories, dirLoading]);

  const onOk = async () => {
    if (selected === null) return;
    const hostIds = selectedRowKeys.map(String);
    setLoading(true);
    try {
      if (assignType === AssignType.Biz) {
        await assignHostsToBusinessIdlePool(selected as number, hostIds);
      } else {
        await addHostsToPoolDirectory(selected as number, hostIds);
      }
      message.success(t('host.assign.modal.success'));
      setSelected(null);
      onClose();
      onSuccess?.(assignType);
    } catch {
      message.error(t('host.assign.modal.error'));
    } finally {
      setLoading(false);
    }
  };

  const onCancel = () => {
    setSelected(null);
    onClose();
  };

  const isAlreadyInDir = (dirId: number) => {
    if (hostPoolStatuses.length === 0) return false;
    return hostPoolStatuses.every((it) => it.moduleId === dirId);
  };

  const directoryOptions = directories
    .filter((dir) => !isAlreadyInDir(dir.bk_module_id))
    .map((dir) => ({ value: dir.bk_module_id, label: dir.bk_module_name }));

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
      okButtonProps={{ disabled: !selected, loading }}
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
          <BusinessSelector
            value={selected}
            onChange={setSelected}
            allowClear={false}
          />
        ) : (
          <Select
            showSearch
            value={selected}
            onChange={setSelected}
            style={{ width: '100%' }}
            placeholder={t('host.assign.modal.placeholder.pool')}
            options={directoryOptions}
            filterOption={(input, option) =>
              String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
          />
        )}
      </div>
    </Modal>
  );
};

export default AssignModal;
