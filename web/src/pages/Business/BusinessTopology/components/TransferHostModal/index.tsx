import React, { useState, useMemo, useRef } from 'react';
import { Modal, Input, List, Button, Checkbox, Radio } from 'antd';
import TopologyTree from '../TopologyTree';
import { businessData2, idleCluster2 } from '@/mock/business';
import { TailEleType, TopoTreeNodeType, TransferMenuItemType, TreeData } from '@/pages/Business/Types';
import './style.css';
import { CloseOutlined } from '@ant-design/icons';

const MIN_WIDTH = 280;
const MAX_WIDTH = 420;

export type TransferType = keyof typeof TransferMenuItemType;
export const typeTitleMap: Partial<Record<TransferType, string>> = {
  idlePool: '转移主机到空闲机池',
  businessModule: '转移主机到业务模块',
};

interface TransferHostModalProps {
  vivible: boolean;
  transferType: TransferMenuItemType | null;
  onClose: () => void;
  onConfirm: (selectedNodes: TreeData[]) => void;
}

const TransferHostModal: React.FC<TransferHostModalProps> = ({ vivible, transferType, onClose, onConfirm }) => {
  // Only maintain selectedKeys in state
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [searchValue, setSearchValue] = useState('');
  const [hoveredPreviewId, setHoveredPreviewId] = useState<React.Key | null>(null);
  // The sidebar state
  const [sidebarWidth, setSidebarWidth] = useState<number>(320);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isDraggerHover, setIsDraggerHover] = useState<boolean>(false);
  const dragging = useRef<boolean>(false);
  
  // Build tree data for each transfer type
  const customTreeData: TreeData[] = useMemo(() => {
    if (transferType === TransferMenuItemType.idlePool) {
      // Only business root, idle pool, and its modules
      return businessData2.map(biz => ({
        title: biz.bk_inst_name,
        key: `${biz.bk_obj_id}-${biz.bk_inst_id}`,
        type: TopoTreeNodeType.Biz,
        objName: biz.bk_obj_name,
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
              parentPath: [biz.bk_inst_name, idleCluster2.bk_set_name],
            }))
          }
        ]
      }));
    } else if (transferType === TransferMenuItemType.businessModule) {
      // Business root, set, and modules
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
    }
    // Default: return empty or extend for other types
    return [];
  }, [transferType]);

  // Recursively find all selected module nodes
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

  const selectedNodes = useMemo(() => getSelectedNodes(selectedKeys, customTreeData), [selectedKeys, customTreeData]);
  const previewList = useMemo(() => (
    transferType === TransferMenuItemType.idlePool ? selectedNodes.slice(0, 1) : selectedNodes
  ), [selectedNodes, transferType]);

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
      if (transferType === TransferMenuItemType.idlePool) {
        setSelectedKeys([node.key]);
      } else if (transferType === TransferMenuItemType.businessModule) {
        setSelectedKeys(prev =>
          prev.includes(node.key) ? prev.filter(k => k !== node.key) : [...prev, node.key]
        );
      }
    }
  };

  // Remove single item from preview
  const handleRemove = (key: string) => {
    setSelectedKeys(selectedKeys.filter(k => k !== key));
  };

  // Clear all
  const handleClear = () => {
    setSelectedKeys([]);
  };

  // Confirm selection
  const handleNextStep = () => {
    if (selectedNodes.length > 0) onConfirm(selectedNodes);
    onClose();
  };

  const handleClose = () => {
    setSelectedKeys([]);
    setSearchValue('');
    onClose();
  }

  const renderCustomTitlePrefix = (node: TreeData) => {
    if (transferType === TransferMenuItemType.idlePool && node.type === TopoTreeNodeType.Module) {
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

  return (
    <Modal
      open={vivible}
      title={typeTitleMap[transferType!] || ''}
      onCancel={handleClose}
      footer={[
        <Button key="cancel" onClick={handleClose}>取消</Button>,
        <Button key="next" type="primary" disabled={previewList.length === 0} onClick={handleNextStep}>下一步</Button>
      ]}
      maskClosable={false}
      width={830}
      style={{ height: 600 }}
      className="transfer-host-modal"
      destroyOnHidden={true}
    >
      <div className="transfer-host-modal-body">
        <div className="transfer-host-modal-left" style={{ width: sidebarWidth, minWidth: MIN_WIDTH, maxWidth: MAX_WIDTH }}>
          <Input.Search
            placeholder="请输入关键字"
            style={{ marginBottom: 4 }}
            value={searchValue}
            onChange={e => setSearchValue(e.target.value)}
          />
          <TopologyTree
            customTreeData={customTreeData}
            customTitlePrefix={renderCustomTitlePrefix}
            onlyLeafSelectable={true}
            tailEleType={TailEleType.None}
            searchValue={searchValue}
            selectedNodes={selectedNodes}
            selectedKeys={selectedKeys}
            onSelectNode={handleSelectNode}
          />
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
