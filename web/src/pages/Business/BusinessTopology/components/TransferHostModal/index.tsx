import React, { useState, useMemo, useEffect } from 'react';
import { Modal, Input, List, Button, Checkbox, Radio, Select, Empty, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { CloseOutlined } from '@ant-design/icons';
import TopologyTree from '../TopologyTree';
import DragHandle from '@/components/common/DragHandle';
import EmptySearchResult from '@/components/common/EmptySearchResult';
import {
  findNodeAndParents,
  filterTree,
  getSelectedNodesByKeys,
  collectAllKeys,
} from '@/pages/Business/utils';
import {
  TailEleType,
  TopoTreeNodeType,
  TransferHostItem,
  TransferHostType,
  TransferMenuItemType,
  TreeData,
  AppendMenuItemKey,
} from '@/pages/Business/Types';
import { getTopologyTree } from '@/api/services/business';
import { useBusinessStore } from '@/store/BusinessStore';
import { adaptTopologyTree } from '@/api/adapters/topologyAdapter';
import './style.css';

const MIN_WIDTH = 280;
const MAX_WIDTH = 420;

const annotateParentPaths = (nodes: TreeData[], ancestors: string[] = []): TreeData[] =>
  nodes.map((node) => {
    const nextAncestors = node.type === TopoTreeNodeType.Module ? ancestors : [...ancestors, String(node.title)];
    return {
      ...node,
      parentPath: node.type === TopoTreeNodeType.Module ? ancestors : node.parentPath,
      children: node.children ? annotateParentPaths(node.children, nextAncestors) : node.children,
    };
  });

const filterTransferNodesByMode = (
  nodes: TreeData[],
  mode: 'businessModule' | 'idlePool',
): TreeData[] =>
  nodes.reduce<TreeData[]>((acc, node) => {
      const backendType = node.backendType || node.type;
      const isBusiness = node.type === TopoTreeNodeType.Biz;
      const isModule = node.type === TopoTreeNodeType.Module;
      const isSet = node.type === TopoTreeNodeType.Set;
      const isIdleSet = backendType === 'idle_set';
      const isIdleModule = backendType === 'idle_module';
      const keepCurrentNode =
        mode === 'businessModule'
          ? isBusiness || (isSet && !isIdleSet) || (isModule && !isIdleModule)
          : isBusiness || isIdleSet || isIdleModule;
      const filteredChildren = node.children
        ? filterTransferNodesByMode(node.children, mode)
        : undefined;

      if (!keepCurrentNode && (!filteredChildren || filteredChildren.length === 0)) {
        return acc;
      }

      acc.push({
        ...node,
        children: filteredChildren,
      });
      return acc;
    }, []);

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
  const { currentBusiness, businessList } = useBusinessStore();

  const typeTitleMap: Partial<Record<TransferHostType, string>> = {
    idlePool: t('business.topology.transferHostModal.titles.idlePool'),
    businessModule: t('business.topology.transferHostModal.titles.businessModule'),
    otherBusiness: t('business.topology.transferHostModal.titles.otherBusiness'),
    [AppendMenuItemKey.AppendToBusinessModule]: t(
      'business.topology.transferHostModal.titles.appendToBusiness',
    ),
  };

  const [searchValue, setSearchValue] = useState('');
  const [selectedBizId, setSelectedBizId] = useState<number | undefined>();
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [previewList, setPreviewList] = useState<TreeData[]>([]);
  const [hoveredPreviewId, setHoveredPreviewId] = useState<React.Key | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState<number>(320);
  const [customTreeData, setCustomTreeData] = useState<TreeData[]>([]);

  const transferStatus = useMemo(() => {
    return {
      isIdlePool: transferType === TransferMenuItemType.idlePool,
      isBusinessModule:
        transferType === TransferMenuItemType.businessModule ||
        transferType === AppendMenuItemKey.AppendToBusinessModule,
      isOtherBusiness: transferType === TransferMenuItemType.otherBusiness,
      isAppendBusinessModule: transferType === AppendMenuItemKey.AppendToBusinessModule,
      isSingleSelect:
        transferType === TransferMenuItemType.idlePool ||
        transferType === TransferMenuItemType.otherBusiness,
    };
  }, [transferType]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const businessId = transferStatus.isOtherBusiness ? selectedBizId : currentBusiness?.id;
    if (!businessId) {
      setCustomTreeData([]);
      return;
    }

    let cancelled = false;

    const loadTree = async () => {
      try {
        const response = await getTopologyTree({
          business_id: businessId,
        });
        if (cancelled) {
          return;
        }

        const adaptedTree = annotateParentPaths(adaptTopologyTree(response.data || []));
        const mode = transferStatus.isBusinessModule ? 'businessModule' : 'idlePool';
        setCustomTreeData(filterTransferNodesByMode(adaptedTree, mode));
      } catch (error) {
        console.error('Failed to load transfer topology tree:', error);
        if (!cancelled) {
          setCustomTreeData([]);
        }
      }
    };

    loadTree();

    return () => {
      cancelled = true;
    };
  }, [
    currentBusiness?.id,
    selectedBizId,
    transferStatus.isBusinessModule,
    transferStatus.isOtherBusiness,
    visible,
  ]);

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
      initialExpandedKeys.forEach((key) => {
        const { parents } = findNodeAndParents(filteredTreeData, key);
        parents.forEach((p) => expandedSet.add(p.key));
        expandedSet.add(key);
      });
      return Array.from(expandedSet);
    }

    // If idlePool/otherBusiness, expand all nodes
    if (transferStatus.isIdlePool || transferStatus.isOtherBusiness) {
      const getAllKeys = (nodes: TreeData[]): string[] => {
        return nodes.flatMap((node) => [
          node.key,
          ...(node.children ? getAllKeys(node.children) : []),
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
      if (transferStatus.isIdlePool || transferStatus.isOtherBusiness) {
        setSelectedKeys([node.key]);
      } else if (transferStatus.isBusinessModule) {
        setSelectedKeys((prev) =>
          prev.includes(node.key) ? prev.filter((k) => k !== node.key) : [...prev, node.key],
        );
      }
    }
  };

  const handleBizChange = (bizId: number) => {
    setSelectedBizId(bizId);
    setSelectedKeys([]);
    setPreviewList([]);
  };

  const handleRemove = (key: string) => {
    setSelectedKeys(selectedKeys.filter((k) => k !== key));
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
      (transferStatus.isIdlePool || transferStatus.isOtherBusiness) &&
      node.type === TopoTreeNodeType.Module
    ) {
      return (
        <Radio
          checked={selectedKeys[0] === node.key}
          onChange={() => handleSelectNode(node)}
          onClick={(e) => e.stopPropagation()}
          style={{ marginRight: 10 }}
        />
      );
    } else if (transferStatus.isBusinessModule && node.type === TopoTreeNodeType.Module) {
      return (
        <Checkbox
          checked={selectedKeys.includes(node.key)}
          onChange={() => handleSelectNode(node)}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          style={{ marginRight: 10 }}
        />
      );
    } else if (node.objName) {
      return <span className="custom-title-prefix">{node.objName.charAt(0)}</span>;
    }
    return null;
  };

  const bizOptions = businessList
    .filter((biz) => biz.id && biz.name)
    .map((biz) => ({
      key: biz.id,
      label: `[${biz.id}] ${biz.name}`,
      value: biz.id,
    }));

  const confirmDisabled = useMemo(() => {
    if (previewList.length === 0) return true;
    if (selectedHosts.length === 0) return true;
    return false;
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
  const confirmBtnText =
    initialSelectedKeys || transferStatus.isOtherBusiness
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
          <span className="next-btn-wrapper">
            <Button type="primary" disabled={confirmDisabled} onClick={handleNextStep}>
              {confirmBtnText}
            </Button>
          </span>
        </Tooltip>,
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
            maxWidth: MAX_WIDTH,
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
                onChange={(bizId) => handleBizChange(bizId)}
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
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value.trim())}
                onClear={() => setSearchValue('')}
              />
            </>
          )}

          {shouldTreeComShow &&
            (isEmptySearchResult ? (
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
            ))}

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
              &nbsp;<span className="preview-count">{previewList.length}</span>
              &nbsp;{t('business.topology.transferHostModal.preview.moduleCountSuffix')}
            </span>
            <Button type="link" onClick={handleClear} disabled={previewList.length === 0}>
              {t('business.topology.transferHostModal.buttons.clear')}
            </Button>
          </div>
          <List
            dataSource={previewList}
            renderItem={(item) => (
              <List.Item
                key={item.key}
                className="preview-item-bg"
                onMouseEnter={() => setHoveredPreviewId(item.key)}
                onMouseLeave={() => setHoveredPreviewId(null)}
              >
                <div className="preview-item-wrapper">
                  <div className="preview-item-content">
                    <span className="preview-prefix">{(item.objName || '').charAt(0)}</span>
                    <span className="preview-name">{item.title}</span>
                  </div>
                  <div className="preview-path">{(item.parentPath || []).join(' / ')}</div>
                </div>
                {hoveredPreviewId === item.key && (
                  <CloseOutlined
                    className="preview-remove"
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
