import React, { useState, useMemo, useEffect } from 'react';
import { Modal, Input, List, Button, Checkbox, Radio, Select, Empty, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { CloseOutlined } from '@ant-design/icons';
import TopologyTree from '../TopologyTree';
import DragHandle from '@/components/common/DragHandle';
import EmptySearchResult from '@/components/common/EmptySearchResult';
import { businessData2, idleCluster2, bizInfo, allHosts2 } from '@/mock/business';
import { findNodeAndParents, isHostAlreadyInTarget, filterTree, getSelectedNodesByKeys, collectAllKeys } from '@/pages/Business/utils';
import {
  TailEleType,
  TopoTreeNodeType,
  TransferHostItem,
  TransferHostType,
  TransferMenuItemType,
  TreeData,
  AppendMenuItemKey
} from '@/pages/Business/Types';
import './style.css';

const MIN_WIDTH = 280;
const MAX_WIDTH = 420;

interface TransferHostModalProps {
  visible: boolean;
  transferType?: TransferHostType;
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
  initialSelectedKeys,
  initialExpandedKeys,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation();

  const typeTitleMap: Partial<Record<TransferHostType, string>> = {
    idlePool: t('business.topology.transferHostModal.titles.idlePool'),
    businessModule: t('business.topology.transferHostModal.titles.businessModule'),
    otherBusiness: t('business.topology.transferHostModal.titles.otherBusiness'),
    [AppendMenuItemKey.AppendToBusinessModule]: t('business.topology.transferHostModal.titles.appendToBusiness'),
  };

  const [searchValue, setSearchValue] = useState('');
  const [selectedBizId, setSelectedBizId] = useState<string | undefined>();
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [previewList, setPreviewList] = useState<TreeData[]>([]);
  const [hoveredPreviewId, setHoveredPreviewId] = useState<React.Key | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState<number>(320);

  const transferStatus = useMemo(() => {
    return {
      isIdlePool: transferType === TransferMenuItemType.idlePool,
      isBusinessModule: (
        transferType === TransferMenuItemType.businessModule
        || transferType === AppendMenuItemKey.AppendToBusinessModule
      ),
      isOtherBusiness: transferType === TransferMenuItemType.otherBusiness,
      isAppendBusinessModule: transferType === AppendMenuItemKey.AppendToBusinessModule,
      isSingleSelect: (
        transferType === TransferMenuItemType.idlePool
        || transferType === TransferMenuItemType.otherBusiness
      )
    };
  }, [transferType]);

  // Helper to build idlePool/otherBusiness tree structure (biz idle pool)
  const buildIdlePoolTree = (bizName: string, bizId?: number): TreeData[] => ([{
    title: bizName,
    key: bizId ? `biz-${bizId}` : bizName,
    type: TopoTreeNodeType.Biz,
    objName: t('business.topology.transferHostModal.objectNames.business'),
    children: [
      {
        title: idleCluster2.bk_set_name,
        key: `set-${idleCluster2.bk_set_id}`,
        type: TopoTreeNodeType.Set,
        objName: t('business.topology.transferHostModal.objectNames.cluster'),
        children: idleCluster2.module.map(mod => ({
          title: mod.bk_module_name,
          key: `module-${mod.bk_module_id}`,
          type: TopoTreeNodeType.Module,
          objName: t('business.topology.transferHostModal.objectNames.module'),
          parentPath: [bizName, idleCluster2.bk_set_name],
        }))
      }
    ]
  }]);

  const customTreeData: TreeData[] = useMemo(() => {
    if (transferStatus.isIdlePool) {
      // idlePool: for each business, build idlePool tree
      return businessData2.map(biz => buildIdlePoolTree(biz.bk_inst_name, biz.bk_inst_id)[0]);
    } else if (transferStatus.isBusinessModule) {
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
    } else if (transferStatus.isOtherBusiness && selectedBizId) {
      const biz = bizInfo.info.find((b) => String(b.bk_biz_id) === selectedBizId);
      if (!biz) return [];
      return buildIdlePoolTree(biz.bk_biz_name!, biz.bk_biz_id);
    }
    return [];
  }, [transferStatus, selectedBizId]);

  // Filter tree data based on search value
  const filteredTreeData: TreeData[] = useMemo(() => {
    if (!searchValue) {
      return customTreeData;
    }
    return filterTree(customTreeData, searchValue);
  }, [customTreeData, searchValue]);

  // Generate expanded keys for search results
  const expandedKeysForSearch = useMemo(() => {
    if (!searchValue || filteredTreeData.length === 0) {
      return [];
    }
    return collectAllKeys(filteredTreeData);
  }, [searchValue, filteredTreeData]);

  const keysToExpand = useMemo(() => {
    if (filteredTreeData.length === 0) {
      return [];
    }

    // If initialExpandedKeys provided, expand those and their parents
    if (initialExpandedKeys && initialExpandedKeys.length > 0) {
      const expandedSet = new Set<string>();
      initialExpandedKeys.forEach(key => {
        const { parents } = findNodeAndParents(filteredTreeData, key);
        parents.forEach(p => expandedSet.add(p.key));
        expandedSet.add(key);
      });
      return Array.from(expandedSet);
    }

    // If idlePool/otherBusiness, expand all nodes
    if (transferStatus.isIdlePool || transferStatus.isOtherBusiness) {
      const getAllKeys = (nodes: TreeData[]): string[] => {
        return nodes.flatMap(node => [
          node.key,
          ...(node.children ? getAllKeys(node.children) : [])
        ]);
      };
      return getAllKeys(filteredTreeData);
    }

    // Expand the first root node by default
    return [filteredTreeData[0].key];

  }, [filteredTreeData, initialExpandedKeys, transferStatus]);

  useEffect(() => {
    if (visible) {
      // If search is active, expand search result nodes
      if (expandedKeysForSearch.length > 0) {
        setExpandedKeys(expandedKeysForSearch);
        // Clear search, keep current expanded state
      } else if (expandedKeys.length === 0) {
        setExpandedKeys(keysToExpand);
      }
    }
  }, [visible, expandedKeys, keysToExpand, expandedKeysForSearch]);

  useEffect(() => {
    if (!visible) return;
    if (initialSelectedKeys && initialSelectedKeys.length > 0) {
      setSelectedKeys(initialSelectedKeys);
    }
  }, [visible, initialSelectedKeys]);


  useEffect(() => {
    const selectedNodes = getSelectedNodesByKeys(selectedKeys, filteredTreeData);
    const list = transferStatus.isSingleSelect ? selectedNodes.slice(0, 1) : selectedNodes;
    setPreviewList(list);
  }, [selectedKeys, filteredTreeData, transferStatus]);

  // Handle node selection (single or multi based on transferType)
  const handleSelectNode = (node: TreeData) => {
    if (node.type === TopoTreeNodeType.Module) {
      if (
        transferStatus.isIdlePool ||
        transferStatus.isOtherBusiness
      ) {
        setSelectedKeys([node.key]);
      } else if (transferStatus.isBusinessModule) {
        setSelectedKeys(prev =>
          prev.includes(node.key) ? prev.filter(k => k !== node.key) : [...prev, node.key]
        );
      }
    }
  };

  const handleBizChange = (bizId: string) => {
    setSelectedBizId(bizId);
    setSelectedKeys([]);
    setPreviewList([]);
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
    setExpandedKeys([]);
    setPreviewList([]);
    setSearchValue('');
    setSelectedBizId(undefined);
    onClose();
  };

  const renderCustomTitlePrefix = (node: TreeData) => {
    if (
      (transferStatus.isIdlePool || transferStatus.isOtherBusiness)
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
    } else if (
      transferStatus.isBusinessModule
      && node.type === TopoTreeNodeType.Module
    ) {
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

  const bizOptions = bizInfo.info.filter((biz) => biz.bk_biz_id && biz.bk_biz_name)
    .map((biz) => ({
      key: String(biz.bk_biz_id),
      label: `[${biz.bk_biz_id}] ${biz.bk_biz_name}`,
      value: String(biz.bk_biz_id),
    }));

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
      return t('business.topology.transferHostModal.tooltips.selectModuleFirst');
    } else if (confirmDisabled) {
      return t('business.topology.transferHostModal.tooltips.hostModuleUnchanged');
    }
    return '';
  }, [previewList, confirmDisabled, t]);

  const shouldTreeComShow = transferStatus.isOtherBusiness ? !!selectedBizId : true;
  const isEmptySearchResult = searchValue && filteredTreeData.length === 0;
  const confirmBtnText = (initialSelectedKeys || transferStatus.isOtherBusiness)
    ? t('business.topology.transferHostModal.buttons.confirm')
    : t('business.topology.transferHostModal.buttons.nextStep');

  return (
    <Modal
      open={visible}
      title={typeTitleMap[transferType!] || ''}
      onCancel={handleClose}
      footer={[
        <Button key="cancel" onClick={handleClose}>
          {t('common.cancel')}
        </Button>,
        <Tooltip key="next" title={confirmTooltip}>
          <span className='next-btn-wrapper'>
            <Button type="primary" disabled={confirmDisabled} onClick={handleNextStep}>
              {confirmBtnText}
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
        <div
          className="transfer-host-modal-left"
          style={{
            width: sidebarWidth,
            minWidth: MIN_WIDTH,
            maxWidth: MAX_WIDTH
          }}
        >
          {transferStatus.isOtherBusiness ? (
            <>
              <Select
                showSearch
                allowClear
                placeholder={t('business.topology.transferHostModal.placeholders.selectBusiness')}
                style={{ width: '100%', marginBottom: 12 }}
                value={selectedBizId}
                onChange={bizId => handleBizChange(bizId)}
                options={bizOptions}
                filterOption={(input, option) =>
                  (option?.label as string).toLowerCase().includes(input.toLowerCase())
                }
              />
              {!selectedBizId && (
                <Empty
                  description={t('business.topology.transferHostModal.empty.selectBusinessFirst')}
                  style={{ marginTop: '40%' }}
                />
              )}
            </>
          ) : (
            <>
              <Input.Search
                allowClear
                placeholder={t('business.topology.transferHostModal.placeholders.searchKeyword')}
                style={{ marginBottom: 4 }}
                value={searchValue}
                onChange={e => setSearchValue(e.target.value.trim())}
                onClear={() => setSearchValue('')}
              />
            </>
          )}

          {
            shouldTreeComShow && (
              isEmptySearchResult ? (
                <EmptySearchResult onClearFilter={() => setSearchValue('')} />
              ) : (
                <TopologyTree
                  treeData={filteredTreeData}
                  onlyLeafSelectable={true}
                  tailEleType={TailEleType.None}
                  searchValue={searchValue}
                  selectedKeys={selectedKeys}
                  expandedKeys={expandedKeys}
                  onNodeSelect={handleSelectNode}
                  customTitlePrefix={renderCustomTitlePrefix}
                />
              )
            )
          }

          {/* The dragger */}
          <DragHandle
            minWidth={MIN_WIDTH}
            maxWidth={MAX_WIDTH}
            currentWidth={sidebarWidth}
            onWidthChange={setSidebarWidth}
          />
        </div>

        {/* Right side */}
        <div className="transfer-host-modal-right">
          <div className="preview-title">
            {t('business.topology.transferHostModal.preview.title')}
          </div>
          <div className="preview-header">
            <span>
              {t('business.topology.transferHostModal.preview.selectedText')}
              &nbsp;<span className='preview-count'>{previewList.length}</span>
              &nbsp;{t('business.topology.transferHostModal.preview.moduleCountSuffix')}
            </span>
            <Button
              type="link"
              onClick={handleClear}
              disabled={previewList.length === 0}>
              {t('business.topology.transferHostModal.buttons.clear')}
            </Button>
          </div>
          <List
            dataSource={previewList}
            renderItem={item => (
              <List.Item
                key={item.key}
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
            locale={{ emptyText: t('business.topology.transferHostModal.empty.noModuleSelected') }}
          />
        </div>
      </div>
    </Modal>
  );
};

export default TransferHostModal;
