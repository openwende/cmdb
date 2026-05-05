import React, { useEffect, useState } from 'react';
import {
  Drawer,
  Steps,
  Alert,
  Upload,
  Typography,
  Button,
  Checkbox,
  Select,
  Table,
  Empty,
  Result,
} from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import {
  InboxOutlined,
  CloseOutlined,
  VerticalAlignBottomOutlined,
  FileExcelOutlined,
  HddOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { useTranslation } from 'react-i18next';
import { HostUniqueKey, hostUniqueOptions } from '@/pages/Resource/constants';
import { modelListMock } from '@/mock/resource';
import {
  batchCreateHosts,
  addHostsToPoolDirectory,
  type BatchCreateHostItem,
} from '@/api/services/resource';
import { useAppMessage } from '@/utils/message';
import './style.css';

const { Dragger } = Upload;
const { Link, Text } = Typography;

interface ImportHostProps {
  visible: boolean;
  selectedDirId?: number;
  onClose: () => void;
  onImportSuccess: () => void;
}

interface RelatedModelRow {
  key: React.Key;
  name: string;
  unique: string;
}

interface ImportErrorResponse {
  response?: {
    data?: {
      error?: string | string[];
      message?: string;
    };
  };
}

enum Step {
  One = 0,
  Two = 1,
  Result = 2,
}
enum ImportStatus {
  None,
  Success,
  Fail,
}

const ImportHost: React.FC<ImportHostProps> = ({
  visible,
  selectedDirId,
  onClose,
  onImportSuccess,
}) => {
  const { t } = useTranslation();
  const message = useAppMessage();
  const [drawerOpen, setDrawerOpen] = useState(visible);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  // Step2 states
  const [step, setStep] = useState(Step.One);
  const [submitting, setSubmitting] = useState(false);
  const [importRelated, setImportRelated] = useState(false);
  const [uniqueKey, setUniqueKey] = useState<HostUniqueKey>(hostUniqueOptions[0].value);
  // Mock related models data (empty for now)
  const [modelList, setModelList] = useState<RelatedModelRow[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const [importStatus, setImportStatus] = useState<ImportStatus>(ImportStatus.None);
  const [resultErrors, setResultErrors] = useState<string[]>([]);

  const columns = [
    { title: t('resource.import.columns.relatedModel'), dataIndex: 'name' },
    { title: t('resource.import.columns.uniqueIdentifier'), dataIndex: 'unique' },
  ];

  useEffect(() => {
    if (step === Step.Two && modelList.length === 0) {
      setModelList(modelListMock);
    }
  }, [modelList.length, step]);

  const getResponseErrors = (error: unknown) => {
    const data = (error as ImportErrorResponse)?.response?.data;
    if (Array.isArray(data?.error)) {
      return data.error;
    }
    if (typeof data?.error === 'string') {
      return [data.error];
    }
    if (typeof data?.message === 'string') {
      return [data.message];
    }
    return undefined;
  };

  useEffect(() => {
    setDrawerOpen(visible);
    if (!visible) {
      resetAll();
    }
  }, [visible]);

  const uploadProps = {
    multiple: false,
    accept: '.xlsx',
    beforeUpload: (file: UploadFile) => {
      setFileList([file]);
      // prevent auto upload
      return false;
    },
    showUploadList: false,
  };

  const handleNext = () => {
    setStep((prev) => prev + 1);
  };

  const handlePrev = () => {
    setStep((prev) => prev - 1);
  };

  const handleImport = async () => {
    const file = fileList[0]?.originFileObj || (fileList[0] as unknown as File);
    if (!file) return;

    setSubmitting(true);
    setResultErrors([]);

    try {
      // Step 1: parse xlsx client-side
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const allRows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' });

      // Skip header row (index 0); map remaining non-empty rows
      const hosts: BatchCreateHostItem[] = allRows
        .slice(1)
        .filter((row) => row[0] || row[1]) // at least host_name or primary_ip present
        .map((row) => {
          const extraIPs = [row[2], row[3]].filter(Boolean) as string[];
          return {
            host_name: String(row[0] || row[1] || '').trim(),
            primary_ip: String(row[1] || '').trim(),
            ...(extraIPs.length ? { ip_addresses: extraIPs } : {}),
            ...(row[4] ? { os_type: String(row[4]).trim().toLowerCase() } : {}),
            ...(row[5] ? { os_version: String(row[5]).trim() } : {}),
          };
        })
        .filter((h) => h.primary_ip); // primary_ip is required

      if (hosts.length === 0) {
        setImportStatus(ImportStatus.Fail);
        setResultErrors([t('resource.import.messages.noValidRows', '文件中没有有效的主机行')]);
        setStep(Step.Result);
        return;
      }

      // Step 2: batch create hosts
      const batchResult = await batchCreateHosts(hosts);
      const createdIds: string[] = batchResult.created_ids ?? [];

      // Step 3: move created hosts into the target directory (if specified)
      if (selectedDirId && createdIds.length > 0) {
        await addHostsToPoolDirectory(selectedDirId, createdIds);
      }

      const errors: string[] = (batchResult.errors ?? []).map(
        (e) => `行 ${e.index + 2} (${e.host_name}): ${e.error}`,
      );

      if (batchResult.successful > 0) {
        onImportSuccess();
        setImportStatus(ImportStatus.Success);
      } else {
        setImportStatus(ImportStatus.Fail);
        setResultErrors(errors.length ? errors : [t('resource.import.messages.importFailed')]);
      }

      if (errors.length > 0) {
        setResultErrors(errors);
      }
    } catch (error: unknown) {
      console.error(error);
      setImportStatus(ImportStatus.Fail);
      setResultErrors(getResponseErrors(error) ?? [t('resource.import.messages.importFailed')]);
      message.error(t('resource.import.messages.importFailed'));
    } finally {
      setSubmitting(false);
      setStep(Step.Result);
    }
  };

  const handleDownloadTemplate = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();

    const rows = [
      ['主机名', '内网IP', '外网IP', '内网IPv6', '操作系统类型', '操作系统版本'],
      ['web-server-01', '10.0.0.1', '', '', 'linux', 'CentOS 7.9'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '主机导入');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    const url = URL.createObjectURL(
      new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'host_import_template.xlsx';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleClose = () => {
    setDrawerOpen(false);
    onClose();
    setTimeout(resetAll, 300);
  };

  const resetAll = () => {
    setFileList([]);
    setImportRelated(false);
    setUniqueKey(hostUniqueOptions[0].value);
    setImportStatus(ImportStatus.None);
    setResultErrors([]);
    setSubmitting(false);
    setStep(Step.One);
    setSelectedKeys([]);
  };

  const renderStepOne = () => {
    return (
      <>
        {/* Alert */}
        <Alert
          type="warning"
          showIcon
          message={t('resource.import.messages.importInfo')}
          className="import-tip"
        />

        {/* Upload area or file card */}
        {fileList.length === 0 ? (
          <Dragger className="import-uploader" {...uploadProps}>
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">
              {t('resource.import.upload.dragText')}
              <Link>{t('resource.import.upload.clickText')}</Link>
            </p>
          </Dragger>
        ) : (
          <div className="file-card">
            <FileExcelOutlined />
            <span className="file-name">{fileList[0]?.name || ''}</span>
            <span className="file-size">{((fileList[0]?.size || 0) / 1024).toFixed(2)}KB</span>
            <CloseOutlined className="file-remove" onClick={() => setFileList([])} />
          </div>
        )}

        {/* hint & download */}
        <div className="bottom-hint">
          <Text>{t('resource.import.upload.fileHint')} </Text>
          <Link onClick={handleDownloadTemplate}>
            <VerticalAlignBottomOutlined />
            {t('resource.import.upload.downloadTemplate')}
          </Link>
        </div>
      </>
    );
  };

  const renderStepTwo = () => {
    return (
      <>
        {/* checkbox */}
        <Checkbox checked={importRelated} onChange={(e) => setImportRelated(e.target.checked)}>
          {t('resource.import.steps.importRelatedModels')}
        </Checkbox>

        {importRelated && (
          <>
            {/* host info box */}
            <div className="host-info-card">
              <span className="host-info">
                <span className="host-label">
                  <HddOutlined />
                </span>
                <span className="host-text">
                  {t('resource.import.host.label')}
                  <span className="host-model-text">{t('resource.import.host.modelText')}</span>
                </span>
              </span>
              <span>
                <span className="unique-label">{t('resource.import.host.uniqueLabel')}</span>
                <Select<HostUniqueKey>
                  size="small"
                  options={hostUniqueOptions.map((option) => ({
                    label: t(option.label),
                    value: option.value,
                  }))}
                  value={uniqueKey}
                  onChange={(value) => setUniqueKey(value)}
                  style={{ width: 180, fontSize: 12 }}
                />
              </span>
            </div>

            {/* related models table or empty */}
            <Table
              dataSource={modelList}
              columns={columns}
              rowSelection={{
                type: 'checkbox',
                selectedRowKeys: selectedKeys,
                onChange: (keys) => setSelectedKeys(keys),
              }}
              pagination={false}
              size="small"
              locale={{
                emptyText: (
                  <Empty
                    description={t('resource.import.messages.noRelatedModels')}
                    className="empty-text"
                  />
                ),
              }}
            />
          </>
        )}
      </>
    );
  };

  const renderResult = () => {
    const isSuccess = importStatus === ImportStatus.Success;
    return (
      <Result
        status={isSuccess ? 'success' : 'error'}
        title={isSuccess ? t('resource.import.result.success') : t('resource.import.result.failed')}
        extra={
          <Button type="primary" onClick={isSuccess ? handleClose : resetAll}>
            {isSuccess ? t('resource.import.result.close') : t('resource.import.result.retry')}
          </Button>
        }
      >
        {!isSuccess && (
          <>
            {(resultErrors.length > 0 ? resultErrors : [t('resource.import.messages.importFailed')]).map((err) => (
              <p key={err}>
                <CloseCircleOutlined className="error-icon" /> {err}
              </p>
            ))}
          </>
        )}
      </Result>
    );
  };

  return (
    <Drawer
      open={drawerOpen}
      title={t('resource.import.title')}
      width={720}
      onClose={handleClose}
      destroyOnHidden={true}
      className="import-host-drawer"
      footer={
        step !== Step.Result ? (
          <div className="drawer-actions">
            {step === Step.One && (
              <Button type="primary" disabled={fileList.length === 0} onClick={handleNext}>
                {t('common.next')}
              </Button>
            )}
            {step === Step.Two && (
              <>
                <Button onClick={handlePrev} disabled={submitting}>
                  {t('common.previous')}
                </Button>
                <Button
                  type="primary"
                  onClick={handleImport}
                  loading={submitting}
                >
                  {t('resource.import.actions.startImport')}
                </Button>
              </>
            )}
            <Button onClick={handleClose} disabled={submitting}>
              {t('common.cancel')}
            </Button>
          </div>
        ) : null
      }
    >
      {/* Step area */}
      {step !== Step.Result && (
        <div className="import-steps">
          <Steps
            size="small"
            current={step}
            items={[
              { title: t('resource.import.steps.upload') },
              { title: t('resource.import.steps.selectModels') },
            ]}
          />
        </div>
      )}

      {step === Step.One && renderStepOne()}
      {step === Step.Two && renderStepTwo()}
      {step === Step.Result && renderResult()}
    </Drawer>
  );
};

export default ImportHost;
