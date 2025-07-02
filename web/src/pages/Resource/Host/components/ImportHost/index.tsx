import React, { useEffect, useState } from 'react';
import { Drawer, Steps, Alert, Upload, Typography, Button, Checkbox, Select, Table, Empty, Result } from 'antd';
import { InboxOutlined, CloseOutlined, VerticalAlignBottomOutlined, FileExcelOutlined, HddOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { hostUniqueOptions } from '@/pages/Resource/constants';
import { hostImportStatus1, hostImportStatus2, modelListMock } from '@/mock/resource';
import hostImportTemplateUrl from '@/assets/templates/host_import_template.xlsx';
import './style.css';

const { Dragger } = Upload;
const { Link, Text } = Typography;

const columns = [
    { title: '关联的模型', dataIndex: 'name' },
    { title: '唯一校验标识', dataIndex: 'unique' }
];

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
    const [fileList, setFileList] = useState<any[]>([]);
    // Step2 states
    const [step, setStep] = useState(Step.One);
    const [importRelated, setImportRelated] = useState(false);
    const [uniqueKey, setUniqueKey] = useState(hostUniqueOptions[0]);
    // Mock related models data (empty for now)
    const [modelList, setModelList] = useState<any[]>([]);
    const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
    const [importStatus, setImportStatus] = useState<ImportStatus>(ImportStatus.None);

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
                    message="说明：导入编辑需要先导出需要修改的实例，并完成编辑修改后才能进行导入编辑操作"
                    className="import-tip"
                />

                {/* Upload area or file card */}
                {fileList.length === 0 ? (
                    <Dragger className="import-uploader" {...uploadProps}>
                        <p className="ant-upload-drag-icon"><InboxOutlined /></p>
                        <p className="ant-upload-text">将文件拖到此处或 <Link>点击上传</Link></p>
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
                    <Text>20M 以内的 xlsx 文件 </Text>
                    <Link href={hostImportTemplateUrl} download="host_import_template.xlsx">
                        <VerticalAlignBottomOutlined />
                        下载模板
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
                    是否导入关联的模型实例
                </Checkbox>

                {importRelated && (
                    <>
                        {/* host info box */}
                        <div className="host-info-card">
                            <span className='host-info'>
                                <span className="host-label"><HddOutlined /></span>
                                <span className="host-text">主机
                                    <span className='host-model-text'>(模型本身)</span>
                                </span>
                            </span>
                            <span>
                                <span>唯一校验标识：</span>
                                <Select
                                    size="small"
                                    options={hostUniqueOptions.map(v => ({ label: v, value: v }))}
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
                                        description="暂无关联模型，无需选择"
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
                title={isSuccess ? '导入成功' : '导入失败'}
                extra={
                    <Button
                        type="primary"
                        onClick={isSuccess ? handleClose : resetAll}
                    >
                        {isSuccess ? '关闭' : '重新导入'}
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
            title="导入主机"
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
                                { title: '上传文件' },
                                { title: '选择关联模型' }
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
                                    下一步
                                </Button>
                            )
                        }
                        {
                            step === Step.Two && (
                                <>
                                    <Button onClick={handlePrev}>上一步</Button>
                                    <Button
                                        type="primary"
                                        onClick={handleImport}
                                        disabled={importRelated && selectedKeys.length === 0}
                                    >
                                        开始导入
                                    </Button>
                                </>
                            )
                        }
                        <Button onClick={handleClose}>取消</Button>
                    </div>
                )
            }
        </Drawer>
    );
};

export default ImportHost;
