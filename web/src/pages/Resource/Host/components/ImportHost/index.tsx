import React, { useEffect, useState } from 'react';
import { Drawer, Steps, Alert, Upload, Typography, Button, Checkbox, Select, Table, Empty, Result } from 'antd';
import { InboxOutlined, CloseOutlined, VerticalAlignBottomOutlined, FileExcelOutlined, HddOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { hostUniqueOptions } from '@/pages/Resource/constants';
import { hostImportStatus1, hostImportStatus2, modelListMock } from '@/mock/resource';
import hostImportTemplateUrl from '@/assets/templates/host_import_template.xlsx';
import './style.css';

const { Dragger } = Upload;
const { Link, Text } = Typography;

interface ImportHostProps {
    visible: boolean;
    selectedDirId?: Number;
    onClose: () => void;
    onImportSuccess: () => void;
}
enum Step {
    One = 0,
    Two = 1,
    Result = 2
}
enum ImportStatus {
    None,
    Success,
    Fail
}

const ImportHost: React.FC<ImportHostProps> = ({ visible, selectedDirId, onClose, onImportSuccess }) => {
    const { t } = useTranslation();
    const [fileList, setFileList] = useState<any[]>([]);
    // Step2 states
    const [step, setStep] = useState(Step.One);
    const [importRelated, setImportRelated] = useState(false);
    const [uniqueKey, setUniqueKey] = useState(hostUniqueOptions[0]);
    // Mock related models data (empty for now)
    const [modelList, setModelList] = useState<any[]>([]);
    const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
    const [importStatus, setImportStatus] = useState<ImportStatus>(ImportStatus.None);

    const columns = [
        { title: t('resource.import.columns.related_model'), dataIndex: 'name' },
        { title: t('resource.import.columns.unique_identifier'), dataIndex: 'unique' }
    ];

    useEffect(() => {
        if (step === Step.Two && modelList.length === 0) {
            setModelList(modelListMock);
        }
    }, [step]);

    const uploadProps = {
        multiple: false,
        accept: '.xlsx',
        beforeUpload: (file: any) => {
            setFileList([file]);
            // prevent auto upload
            return false;
        },
        showUploadList: false
    };

    const handleNext = () => {
        setStep(prev => prev + 1);
    };

    const handlePrev = () => {
        setStep(prev => prev - 1);
    };

    const handleImport = async () => {
        if (fileList.length === 0) return;
        const formData = new FormData();
        formData.append('file', fileList[0]);
        formData.append('params', JSON.stringify({ bk_module_id: selectedDirId, op: 2 }));

        // TODO: replace with real api
        // await axiosInstance.post('/host/import', formData });

        setTimeout(() => {
            const res = Math.random() > 0.5 ? hostImportStatus2 : hostImportStatus1;
            if (res.success) {
                onImportSuccess();
                setImportStatus(ImportStatus.Success);
            } else {
                setImportStatus(ImportStatus.Fail);
            }
            setStep(Step.Result);
        }, 1000);
    };

    const handleClose = () => {
        onClose();
        // wait for animation end
        setTimeout(resetAll, 1000);
    }

    const resetAll = () => {
        setFileList([]);
        setImportRelated(false);
        setUniqueKey(hostUniqueOptions[0]);
        setImportStatus(ImportStatus.None);
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
                    message={t('resource.import.messages.import_info')}
                    className="import-tip"
                />

                {/* Upload area or file card */}
                {fileList.length === 0 ? (
                    <Dragger className="import-uploader" {...uploadProps}>
                        <p className="ant-upload-drag-icon"><InboxOutlined /></p>
                        <p className="ant-upload-text">{t('resource.import.upload.dragText')} <Link>{t('resource.import.upload.clickText')}</Link></p>
                    </Dragger>
                ) : (
                    <div className="file-card">
                        <FileExcelOutlined />
                        <span className="file-name">{fileList[0].name}</span>
                        <span className="file-size">{(fileList[0].size / 1024).toFixed(2)}KB</span>
                        <CloseOutlined className="file-remove" onClick={() => setFileList([])} />
                    </div>
                )}

                {/* hint & download */}
                <div className="bottom-hint">
                    <Text>{t('resource.import.upload.fileHint')} </Text>
                    <Link href={hostImportTemplateUrl} download="host_import_template.xlsx">
                        <VerticalAlignBottomOutlined />
                        {t('resource.import.upload.downloadTemplate')}
                    </Link>
                </div>
            </>
        );
    }

    const renderStepTwo = () => {
        return (
            <>
                {/* checkbox */}
                <Checkbox
                    checked={importRelated}
                    onChange={e => setImportRelated(e.target.checked)}
                >
                    {t('resource.import.steps.import_related_models')}
                </Checkbox>

                {importRelated && (
                    <>
                        {/* host info box */}
                        <div className="host-info-card">
                            <span className='host-info'>
                                <span className="host-label"><HddOutlined /></span>
                                <span className="host-text">{t('resource.import.host.label')}
                                    <span className='host-model-text'>{t('resource.import.host.model_text')}</span>
                                </span>
                            </span>
                            <span>
                                <span>{t('resource.import.host.unique_label')}</span>
                                <Select
                                    size="small"
                                    options={hostUniqueOptions.map(v => ({ label: t(v), value: v }))}
                                    value={uniqueKey}
                                    onChange={setUniqueKey}
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
                                onChange: keys => setSelectedKeys(keys)
                            }}
                            pagination={false}
                            size="small"
                            locale={{
                                emptyText: (
                                    <Empty
                                        description={t('resource.import.messages.no_related_models')}
                                        className="empty-text"
                                    />
                                )
                            }}
                        />
                    </>
                )}
            </>
        );
    }

    const renderResult = () => {
        const isSuccess = importStatus === ImportStatus.Success;
        return (
            <Result
                status={isSuccess ? 'success' : 'error'}
                title={isSuccess ? t('resource.import.result.success') : t('resource.import.result.failed')}
                extra={
                    <Button
                        type="primary"
                        onClick={isSuccess ? handleClose : resetAll}
                    >
                        {isSuccess ? t('resource.import.result.close') : t('resource.import.result.retry')}
                    </Button>
                }
            >
                {!isSuccess && (
                    <>
                        {
                            hostImportStatus1.error.map(err => (
                                <p key={err}>
                                    <CloseCircleOutlined className="error-icon" /> {err}
                                </p>
                            ))
                        }
                    </>
                )}
            </Result>
        );
    };

    return (
        <Drawer
            open={visible}
            title={t('resource.import.title')}
            width={720}
            onClose={handleClose}
            destroyOnHidden={true}
            className="import-host-drawer"
        >
            {/* Step area */}
            {
                step !== Step.Result && (
                    <div className="import-steps">
                        <Steps
                            size="small"
                            current={step}
                            items={[
                                { title: t('resource.import.steps.upload') },
                                { title: t('resource.import.steps.select_models') }
                            ]}
                        />
                    </div>
                )
            }

            {step === Step.One && renderStepOne()}
            {step === Step.Two && renderStepTwo()}
            {step === Step.Result && renderResult()}

            {/* actions */}
            {
                step !== Step.Result && (
                    <div className="drawer-actions">
                        {
                            step === Step.One && (
                                <Button
                                    type="primary"
                                    disabled={fileList.length === 0}
                                    onClick={handleNext}
                                >
                                    {t('common.next')}
                                </Button>
                            )
                        }
                        {
                            step === Step.Two && (
                                <>
                                    <Button onClick={handlePrev}>{t('common.previous')}</Button>
                                    <Button
                                        type="primary"
                                        onClick={handleImport}
                                        disabled={importRelated && selectedKeys.length === 0}
                                    >
                                        {t('resource.import.actions.start_import')}
                                    </Button>
                                </>
                            )
                        }
                        <Button onClick={handleClose}>{t('common.cancel')}</Button>
                    </div>
                )
            }
        </Drawer>
    );
};

export default ImportHost;
