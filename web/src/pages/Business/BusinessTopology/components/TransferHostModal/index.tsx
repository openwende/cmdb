import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Modal, Input, List, Button, Checkbox, Radio, Select, Empty, Tooltip } from 'antd';
import TopologyTree from '../TopologyTree';
import { businessData2, idleCluster2, bizInfo, allHosts2 } from '@/mock/business';
import { TailEleType, TopoTreeNodeType, TransferHostItem, TransferHostType, TransferMenuItemType, TreeData } from '@/pages/Business/Types';
import './style.css';
import { CloseOutlined } from '@ant-design/icons';
import { findNodeAndParents, isHostAlreadyInTarget } from '@/pages/Business/utils';

const MIN_WIDTH = 280;
const MAX_WIDTH = 420;

export const typeTitleMap: Partial<Record<TransferHostType, string>> = {
  idlePool: '转移主机到空闲机池',
  businessModule: '转移主机到业务模块',
  otherBusiness: '转移主机到其他业务',
};

interface TransferHostModalProps {
  visible: boolean;
  transferType?: TransferMenuItemType;
  selectedHosts: TransferHostItem[];
  initialSelectedKeys?: string[];
  initialExpandedKeys?: string[];
  onClose: () => void;
  onConfirm: (selectedNodes: TreeData[]) => void;
}

const TransferHostModal: React.FC<TransferHostModalProps> = ({
  visible,
  transferType,
  selectedHosts,
  onClose,
  onConfirm,
  initialSelectedKeys,
  initialExpandedKeys
}) => {
  const [searchValue, setSearchValue] = useState('');
  const [selectedBizId, setSelectedBizId] = useState<string | undefined>();
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [previewList, setPreviewList] = useState<TreeData[]>([]);
  const [hoveredPreviewId, setHoveredPreviewId] = useState<React.Key | null>(null);
  // State for sidebar
  const [sidebarWidth, setSidebarWidth] = useState<number>(320);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isDraggerHover, setIsDraggerHover] = useState<boolean>(false);
  const dragging = useRef<boolean>(false);

  // Helper to build idlePool/otherBusiness tree structure (biz idle pool)
  const buildIdlePoolTree = (bizName: string): TreeData[] => ([{
    title: bizName,
    key: bizName,
    type: TopoTreeNodeType.Biz,
    objName: '业务',
    children: [
      {
        title: idleCluster2.bk_set_name,
        key: `set-${idleCluster2.bk_set_id}`,
        type: TopoTreeNodeType.Set,
        objName: '集群',
        children: idleCluster2.module.map(mod => ({
          title: mod.bk_module_name,
          key: `module-${mod.bk_module_id}`,
          type: TopoTreeNodeType.Module,
          objName: '模块',
          parentPath: [bizName, idleCluster2.bk_set_name],
        }))
      }
    ]
  }]);

  const customTreeData: TreeData[] = useMemo(() => {
    if (transferType === TransferMenuItemType.idlePool) {
      // idlePool: for each business, build idlePool tree
      return businessData2.map(biz => buildIdlePoolTree(biz.bk_inst_name)[0]);
    } else if (transferType === TransferMenuItemType.businessModule) {
      return businessData2.map(biz => ({
        title: biz.bk_inst_name,
        key: `${biz.bk_obj_id}-${biz.bk_inst_id}`,
        type: TopoTreeNodeType.Biz,
        objName: biz.bk_obj_name,
        children: (biz.child || []).map(set => ({
          title: set.bk_inst_name,
          key: `${set.bk_obj_id}-${set.bk_inst_id}`,
          type: TopoTreeNodeType.Set,
          objName: set.bk_obj_name,
          children: (set.child || []).map(mod => ({
            title: mod.bk_inst_name,
            key: `${mod.bk_obj_id}-${mod.bk_inst_id}`,
            type: TopoTreeNodeType.Module,
            objName: mod.bk_obj_name,
            parentPath: [biz.bk_inst_name, set.bk_inst_name],
          }))
        }))
      }));
    } else if (transferType === TransferMenuItemType.otherBusiness && selectedBizId) {
      const biz = bizInfo.info.find((b: { bk_biz_id: number }) => String(b.bk_biz_id) === selectedBizId);
      if (!biz) return [];
      return buildIdlePoolTree(biz.bk_biz_name);
    }
    return [];
  }, [transferType, selectedBizId]);

  useEffect(() => {
    if (!visible) return;
    if (!customTreeData || customTreeData.length === 0) return;

    let expandedKeys: string[] = [];
    if (initialExpandedKeys && initialExpandedKeys.length > 0) {
      const expandedSet = new Set<string>();
      initialExpandedKeys.forEach(key => {
        const { parents } = findNodeAndParents(customTreeData, key);
        parents.forEach(p => expandedSet.add(p.key));
        expandedSet.add(key);
      });
      expandedKeys = Array.from(expandedSet);
    } else {
      expandedKeys = [customTreeData[0].key];
    }

    setExpandedKeys(expandedKeys);
  }, [visible, customTreeData, initialExpandedKeys]);

  useEffect(() => {
    if (!visible) return;
    if (initialSelectedKeys && initialSelectedKeys.length > 0) {
      setSelectedKeys(initialSelectedKeys);
    }
  }, [visible, initialSelectedKeys]);

  const getSelectedNodes = (keys: string[], tree: TreeData[]): TreeData[] => {
    const result: TreeData[] = [];
    const traverse = (nodes: TreeData[]) => {
      nodes.forEach(node => {
        if (node.type === TopoTreeNodeType.Module && keys.includes(node.key)) {
          result.push(node);
        }
        if (node.children) traverse(node.children);
      });
    };
    traverse(tree);
    return result;
  };

  useEffect(() => {
    const selectedNodes = getSelectedNodes(selectedKeys, customTreeData);
    const list = (
      transferType === TransferMenuItemType.idlePool
      || transferType === TransferMenuItemType.otherBusiness
    ) ? selectedNodes.slice(0, 1) : selectedNodes;
    setPreviewList(list);
  }, [selectedKeys, customTreeData, transferType]);

  // Handle drag sidebar
  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    setIsDragging(true);
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!dragging.current) return;
      const delta = moveEvent.clientX - startX;
      let newWidth = startWidth + delta;
      if (newWidth < MIN_WIDTH) newWidth = MIN_WIDTH;
      if (newWidth > MAX_WIDTH) newWidth = MAX_WIDTH;
      setSidebarWidth(newWidth);
    };

    const onMouseUp = () => {
      dragging.current = false;
      setIsDragging(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // Handle node selection (single or multi based on transferType)
  const handleSelectNode = (node: TreeData) => {
    if (node.type === TopoTreeNodeType.Module) {
      if (
        transferType === TransferMenuItemType.idlePool ||
        transferType === TransferMenuItemType.otherBusiness
      ) {
        setSelectedKeys([node.key]);
      } else if (transferType === TransferMenuItemType.businessModule) {
        setSelectedKeys(prev =>
          prev.includes(node.key) ? prev.filter(k => k !== node.key) : [...prev, node.key]
        );
      }
    }
  };

  const handleRemove = (key: string) => {
    setSelectedKeys(selectedKeys.filter(k => k !== key));
  };

  const handleClear = () => {
    setSelectedKeys([]);
  };

  const handleNextStep = () => {
    onConfirm(previewList);
    handleClose();
  };

  const handleClose = () => {
    setSelectedKeys([]);
    setPreviewList([]);
    setSearchValue('');
    setSelectedBizId(undefined);
    onClose();
  };

  const renderCustomTitlePrefix = (node: TreeData) => {
    if (
      (transferType === TransferMenuItemType.idlePool || transferType === TransferMenuItemType.otherBusiness)
      && node.type === TopoTreeNodeType.Module
    ) {
      return (
        <Radio
          checked={selectedKeys[0] === node.key}
          onChange={() => handleSelectNode(node)}
          onClick={e => e.stopPropagation()}
          style={{ marginRight: 10 }}
        />
      );
    } else if (transferType === TransferMenuItemType.businessModule && node.type === TopoTreeNodeType.Module) {
      return (
        <Checkbox
          checked={selectedKeys.includes(node.key)}
          onChange={() => handleSelectNode(node)}
          onClick={e => {
            e.stopPropagation();
            e.preventDefault();
          }}
          style={{ marginRight: 10 }}
        />
      );
    } else if (node.objName) {
      return <span className='custom-title-prefix'>{node.objName.charAt(0)}</span>;
    }
    return null;
  };

  const bizOptions = bizInfo.info.map((biz: { bk_biz_id: number; bk_biz_name: string }) => ({
    label: `[${biz.bk_biz_id}] ${biz.bk_biz_name}`,
    value: String(biz.bk_biz_id),
  }));

  const isShowTreeCom = transferType === TransferMenuItemType.otherBusiness ? !!selectedBizId : true;

  const confirmDisabled = useMemo(() => {
    if (previewList.length === 0) return true;
    if (selectedHosts.length === 0) return true;
    // Disable if all hosts are already in all target modules
    return selectedHosts.every(host =>
      previewList.every(moduleNode => isHostAlreadyInTarget(allHosts2, host.id, moduleNode))
    );
  }, [previewList, selectedHosts]);

  const confirmTooltip = useMemo(() => {
    if (previewList.length === 0) {
      return '请先选择业务模块';
    } else if (confirmDisabled) {
      return '主机所属模块未发生改变';
    }
    return '';
  }, [previewList, confirmDisabled]);

  return (
    <Modal
      open={visible}
      title={typeTitleMap[transferType!] || ''}
      onCancel={handleClose}
      footer={[
        <Button key="cancel" onClick={handleClose}>取消</Button>,
        <Tooltip title={confirmTooltip}>
          <span key="next" className='next-btn-wrapper'>
            <Button type="primary" disabled={confirmDisabled} onClick={handleNextStep}>
              {initialSelectedKeys ? '确定' : '下一步'}
            </Button>
          </span>
        </Tooltip>
      ]}
      maskClosable={false}
      width={830}
      style={{ height: 600 }}
      className="transfer-host-modal"
      destroyOnHidden={true}
    >
      <div className="transfer-host-modal-body">
        {/* Left side */}
        <div className="transfer-host-modal-left" style={{ width: sidebarWidth, minWidth: MIN_WIDTH, maxWidth: MAX_WIDTH }}>
          {transferType === TransferMenuItemType.otherBusiness ? (
            <>
              <Select
                showSearch
                allowClear
                placeholder="请选择业务"
                style={{ width: '100%', marginBottom: 12 }}
                value={selectedBizId}
                onChange={v => setSelectedBizId(v)}
                options={bizOptions}
                filterOption={(input, option) =>
                  (option?.label as string).toLowerCase().includes(input.toLowerCase())
                }
              />
              {!selectedBizId && (
                <Empty description="请先选择业务" style={{ marginTop: '40%' }} />
              )}
            </>
          ) : (
            <>
              <Input.Search
                placeholder="请输入关键字"
                style={{ marginBottom: 4 }}
                value={searchValue}
                onChange={e => setSearchValue(e.target.value)}
              />
            </>
          )}
          {
            isShowTreeCom && <TopologyTree
              customTreeData={customTreeData}
              customTitlePrefix={renderCustomTitlePrefix}
              onlyLeafSelectable={true}
              tailEleType={TailEleType.None}
              searchValue={searchValue}
              selectedKeys={selectedKeys}
              onSelectNode={handleSelectNode}
              expandedKeys={expandedKeys}
            />
          }
          {/* The dragger */}
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              width: 2,
              height: '100%',
              cursor: 'col-resize',
              zIndex: 10,
              background: isDragging || isDraggerHover ? '#1890ff' : 'transparent',
              borderRadius: 3,
              transition: 'background 0.2s',
            }}
            onMouseDown={onMouseDown}
            onMouseEnter={() => setIsDraggerHover(true)}
            onMouseLeave={() => setIsDraggerHover(false)}
          />
        </div>
        {/* Right side */}
        <div className="transfer-host-modal-right">
          <div className="preview-title">结果预览</div>
          <div className="preview-header">
            <span>已选择 <span className='preview-count'>{previewList.length}</span> 个模块</span>
            <Button type="link" onClick={handleClear} disabled={previewList.length === 0}>清空</Button>
          </div>
          <List
            dataSource={previewList}
            renderItem={item => (
              <List.Item
                className="preview-item-bg"
                onMouseEnter={() => setHoveredPreviewId(item.key)}
                onMouseLeave={() => setHoveredPreviewId(null)}
              >
                <div className="preview-item-wrapper">
                  <div className='preview-item-content'>
                    <span className='preview-prefix'>{(item.objName || '').charAt(0)}</span>
                    <span className="preview-name">{item.title}</span>
                  </div>
                  <div className="preview-path">{(item.parentPath || []).join(' / ')}</div>
                </div>
                {hoveredPreviewId === item.key && (
                  <CloseOutlined
                    className='preview-remove'
                    onClick={() => handleRemove(item.key)}
                  />
                )}
              </List.Item>
            )}
            locale={{ emptyText: '暂无模块选中' }}
          />
        </div>
      </div>
    </Modal>
  );
};

export default TransferHostModal;
