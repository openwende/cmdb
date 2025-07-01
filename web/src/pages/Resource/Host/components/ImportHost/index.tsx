import React, { useState } from 'react';
import { Drawer, Steps, Alert, Upload, Typography, Button, Checkbox, Select, Table, Empty, Result } from 'antd';
import { InboxOutlined, CloseOutlined, VerticalAlignBottomOutlined } from '@ant-design/icons';
import { hostUniqueOptions } from '@/pages/Resource/constants';
import { hostImportStatus1, hostImportStatus2 } from '@/mock/resource';
import './style.css';

const { Dragger } = Upload;
const { Link, Text } = Typography;

const columns = [
    { title: '关联的模型', dataIndex: 'name' },
    { title: '唯一校验标识', dataIndex: 'unique' }
];

interface ImportHostProps {
    visible: boolean;
    onClose: () => void;
}
enum Step {
    One = 1,
    Two = 2,
    Result = 3
}

enum ImportStatus {
    None,
    Success,
    Fail
}

const ImportHost: React.FC<ImportHostProps> = ({ visible, onClose }) => {
    const [fileList, setFileList] = useState<any[]>([]);
    // Step2 states
    const [step, setStep] = useState(Step.One);
    const [importRelated, setImportRelated] = useState(false);
    const [uniqueKey, setUniqueKey] = useState(hostUniqueOptions[0]);
    // Mock related models data (empty for now)
    const [relatedModels] = useState<any[]>([]);

    const [loading, setLoading] = useState(false);
    const [importStatus, setImportStatus] = useState<ImportStatus>(ImportStatus.None);

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

    const handleImport = () => {
        setLoading(true);
        // simulate api call using mock
        setTimeout(() => {
            const res = Math.random() > 0.5 ? hostImportStatus2 : hostImportStatus1;
            if (res.success) {
                setImportStatus(ImportStatus.Success);
            } else {
                setImportStatus(ImportStatus.Fail);
            }
            setLoading(false);
            setStep(Step.Result);
        }, 1000);
    };

    const handleClose = () => {
        onClose();
        resetAll();
    }

    const resetAll = () => {
        setFileList([]);
        setImportRelated(false);
        setUniqueKey(hostUniqueOptions[0]);
        setImportStatus(ImportStatus.None);
        setStep(Step.One);
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
                    <Dragger className="import-uploader" style={{ height: 100 }} {...uploadProps}>
                        <p className="ant-upload-drag-icon"><InboxOutlined /></p>
                        <p className="ant-upload-text">将文件拖到此处或 <Link>点击上传</Link></p>
                    </Dragger>
                ) : (
                    <div className="file-card">
                        <span className="file-name">{fileList[0].name}</span>
                        <span className="file-size">{(fileList[0].size / 1024).toFixed(2)}KB</span>
                        <CloseOutlined className="file-remove" onClick={() => setFileList([])} />
                    </div>
                )}

                {/* hint & download */}
                <div className="bottom-hint">
                    <Text>20M 以内的 xlsx 文件 </Text>
                    <Link href="/template/host_import_template.xlsx" download>
                        <VerticalAlignBottomOutlined />下载模板
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
                                <span className="host-label"><InboxOutlined /></span>
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
                            dataSource={relatedModels}
                            columns={columns}
                            rowSelection={{ type: 'checkbox' }}
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
                    <Button type="primary" onClick={isSuccess ? handleClose : resetAll}>
                        {isSuccess ? '关闭' : '重新导入'}
                    </Button>
                }
            >
                {importStatus === ImportStatus.Fail && (
                    <Alert
                        type="error"
                        showIcon
                        message={hostImportStatus1.error[0]}
                        banner
                    />
                )}
            </Result>
        );
    };

    return (
        <Drawer
            open={visible}
            title="导入主机"
            width={720}
            onClose={onClose}
            className="import-host-drawer"
        >
            {/* Step area */}
            {
                step !== Step.Result && <div className="import-steps">
                    <Steps
                        size="small"
                        current={step}
                        items={[
                            { title: '上传文件' },
                            { title: '选择关联模型' }
                        ]}
                    />
                </div>
            }

            {step === Step.One && renderStepOne()}
            {step === Step.Two && renderStepTwo()}
            {!loading && step === Step.Result && renderResult()}

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
                                        disabled={importRelated && relatedModels.length === 0}
                                    >
                                        开始导入
                                    </Button>
                                </>
                            )
                        }
                        <Button onClick={onClose}>取消</Button>
                    </div>
                )
            }
        </Drawer>
    );
};

export default ImportHost;
