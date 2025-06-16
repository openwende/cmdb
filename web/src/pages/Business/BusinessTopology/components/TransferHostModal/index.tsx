import React, { useState, useMemo, useRef } from 'react';
import { Modal, Input, List, Button, Radio } from 'antd';
import type { RadioChangeEvent } from 'antd/es/radio';
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
};

interface TransferHostModalProps {
  vivible: boolean;
  transferType: TransferMenuItemType | null;
  onClose: () => void;
  onConfirm: (selectedNodes: TreeData[]) => void;
}

const TransferHostModal: React.FC<TransferHostModalProps> = ({ vivible, transferType, onClose, onConfirm }) => {
  const [selectedKey, setSelectedKey] = useState<string | undefined>();
  const [selectedNode, setSelectedNode] = useState<TreeData | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [hoveredPreviewId, setHoveredPreviewId] = useState<React.Key | null>(null);
  // The sidebar state
  const [sidebarWidth, setSidebarWidth] = useState<number>(320);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isDraggerHover, setDraggerHover] = useState<boolean>(false);
  const dragging = useRef<boolean>(false);

  // Result preview only allows single selection
  const selectedModules = selectedNode ? [selectedNode] : [];

  const customTreeData: TreeData[] = useMemo(() => {
    if (transferType === TransferMenuItemType.idlePool) {
      // Only includes business root nodes, the idle pool, and its child nodes
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
    }
    // Other type 
    return [];
  }, [transferType]);


  // The dragger event
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
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  // Handle node selection (only leaf selectable)
  const handleSelectNode = (node: TreeData) => {
    if (!node.children || node.children.length === 0) {
      setSelectedKey(node.key);
      setSelectedNode(node);
    }
  };

  const handleRadioChange = (e: RadioChangeEvent, node: TreeData) => {
    if (e.target.checked) {
      setSelectedKey(node.key);
      setSelectedNode(node);
    }
  };

  // Remove single item
  const handleRemove = (key: string) => {
    // TODO: consider multiy keys
    setSelectedKey(undefined);
    setSelectedNode(null);
  };

  // Clear all
  const handleClear = () => {
    setSelectedKey(undefined);
    setSelectedNode(null);
  };

  const handleNextStep = () => {
    if (selectedNode !== null) onConfirm([selectedNode]);
    onClose();
  };

  const renderCustomTitlePrefix = (node: TreeData, isSelected: boolean) => {
    // For module nodes in idle pool
    if (transferType === TransferMenuItemType.idlePool && node.type === TopoTreeNodeType.Module) {
      return (
        <Radio
          checked={isSelected}
          onChange={e => handleRadioChange(e, node)}
          style={{ marginRight: 10 }}
        />
      );
    } else {
      if (node.objName) {
        return <span className='custom-title-prefix'>
          {node.objName.charAt(0)}
        </span>;
      }
    }
  };

  return (
    <Modal
      open={vivible}
      title={typeTitleMap[transferType!] || ''}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>取消</Button>,
        <Button key="next" type="primary" disabled={!selectedNode} onClick={handleNextStep}>下一步</Button>
      ]}
      maskClosable={false}
      width={830}
      style={{ height: 600 }}
      className="transfer-host-modal"
    >
      <div className="transfer-host-modal-body">
        <div className="transfer-host-modal-left" style={{
          width: sidebarWidth,
          minWidth: MIN_WIDTH,
          maxWidth: MAX_WIDTH,
        }}>
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
            selectedNode={selectedNode}
            selectedKey={selectedKey}
            onSelectNode={handleSelectNode}
          />
          {/* The dragger */}
          <div
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              width: 2,
              height: "100%",
              cursor: "col-resize",
              zIndex: 10,
              background: isDragging || isDraggerHover ? "#1890ff" : "transparent",
              borderRadius: 3,
              transition: "background 0.2s"
            }}
            onMouseDown={onMouseDown}
            onMouseEnter={() => setDraggerHover(true)}
            onMouseLeave={() => setDraggerHover(false)}
          />
        </div>
        <div className="transfer-host-modal-right">
          <div className="preview-title">结果预览</div>
          <div className="preview-header">
            <span>已选择 <span className='preview-count'>{selectedModules.length}</span> 个模块</span>
            <Button type="link" onClick={handleClear} disabled={selectedModules.length === 0}>清空</Button>
          </div>
          <List
            dataSource={selectedModules}
            renderItem={item => (
              <List.Item
                className="preview-item-bg"
                style={{ background: '#f5f7fa', marginBottom: 2, borderRadius: 4, padding: 10 }}
                onMouseEnter={() => setHoveredPreviewId(item.key)}
                onMouseLeave={() => setHoveredPreviewId(null)}
              >
                <div className="preview-item-wrapper">
                  <div className='preview-item-content'>
                    <span className='preview-prefix'>
                      {(item.objName || '').charAt(0)}
                    </span>
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
    </Modal >
  );
};

export default TransferHostModal;
