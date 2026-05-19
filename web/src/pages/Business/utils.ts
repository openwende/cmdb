import {
  TransferHostItem,
  RawNodeData,
  TopoTreeNodeType,
  TreeData,
  Property,
  Condition,
  ConditionType,
  DynamicGroupCondition,
  DynamicGroupConditionGroup,
  OperatorType,
  CopyMenuItemKey as HostCopyKey,
} from './Types';
import { QUERY_OPERATOR, BUILTIN_MODELS, BUILTIN_MODEL_PROPERTY_KEYS } from './constants';
import { TFunction } from 'i18next';

/**
 * Transter the input data into the format which Cascader need
 *
 * @param serviceCategory
 * @returns
 */
export function buildCascaderOptions(serviceCategory: any[]) {
  return serviceCategory
    .filter((c) => c.category.bk_parent_id === 0)
    .map((parent) => ({
      value: parent.category.id,
      label: parent.category.name,
      children: serviceCategory
        .filter((child) => child.category.bk_parent_id === parent.category.id)
        .map((child) => ({
          value: child.category.id,
          label: child.category.name,
        })),
    }));
}

/**
 * Create the property for service template
 */
export const createServiceTemplateProperty = (t: TFunction): Property => {
  return {
    id: Date.now(),
    bk_obj_id: 'module',
    bk_property_id: 'service_template_id',
    bk_property_name: t('business.dynamicGroupForm.conditionPicker.serviceTemplate'),
    bk_property_index: -1,
    bk_property_type: 'service-template',
    isonly: true,
    ispre: true,
    option: '',
    bk_property_group: null,
    bk_property_group_name: '',
    unit: '',
    placeholder: '',
    bk_isapi: true,
    bk_issystem: true,
    editable: false,
    bk_asst_obj_id: '',
    _is_inject_: true,
  };
};

/**
 * Get the translated condition name
 * @param conditionType - The condition type enum value
 * @param t - The translation function
 * @returns The translated condition name
 */
export const getConditionName = (conditionType: ConditionType, t: TFunction): string => {
  return conditionType === ConditionType.IMMUTABLE
    ? t('business.dynamicGroupForm.conditionNames.immutable')
    : t('business.dynamicGroupForm.conditionNames.variable');
};

/**
 * Get the translated query operator description
 * @param operator - The query operator value
 * @param t - The translation function
 * @returns The translated operator description
 */
export const getQueryOperatorDesc = (operator: string, t: TFunction): string => {
  const operatorKey = operator.replace('$', '');
  const keyMap: Record<string, string> = {
    eq: 'eq',
    ne: 'ne',
    lt: 'lt',
    gt: 'gt',
    in: 'in',
    nin: 'nin',
    range: 'range',
    lte: 'lte',
    gte: 'gte',
    regex: 'like',
    contains: 'contains',
    contains_s: 'containsCs',
  };

  const translationKey = keyMap[operatorKey] || operatorKey;
  return t(`business.dynamicGroupForm.queryOperatorDesc.${translationKey}`);
};

/**
 * Get the formatted topo_path for the selected node
 *
 * @param selectedNode The selected node object
 * @param transferTargetData The JSON data containing topology node information
 * @returns The formatted topo_path_string
 */
export function getFormattedTopoPath(
  selectedNode: TreeData | null,
  transferTargetData: any,
): string {
  if (!selectedNode || !transferTargetData) {
    return '';
  }

  // Extract the number ID from the selectedNode.key
  const selectedNodeId = parseInt(selectedNode.key.match(/(\d+)$/)?.[1] || '0', 10);

  // Find the matching node in transferTargetData.nodes
  const matchedNode = transferTargetData.nodes.find((node: any) => {
    return node.topo_node.bk_inst_id === selectedNodeId;
  });

  if (matchedNode) {
    // Reverse the array to make the order from the outer most to the inner most
    const reversedPath = [...matchedNode.topo_path].reverse();

    // Create a formatted path string
    return reversedPath.map((pathItem: any) => pathItem.bk_inst_name).join(' / ');
  }

  return '';
}

/**
 * Check whether the selected host(s) are in the idle pool
 *
 * @param selectedRowKeys Array of selected host keys (host IDs)
 * @param allHostsData Host data
 * @param idleSetID Idle pool set ID
 * @returns Array<HostIdleStatus>
 */
export function checkHostsInIdlePool(
  selectedRowKeys: React.Key[],
  allHostsData: any[],
  idleSetID: number | null,
): TransferHostItem[] {
  if (idleSetID == null) return [];
  return selectedRowKeys.flatMap((key) => {
    const hostItem = allHostsData.find((h) => h.host.bk_host_id === key);
    if (!hostItem?.host) {
      return [];
    }
    const inIdlePool = hostItem?.set?.some((s: any) => s.bk_set_id === idleSetID) ?? false;
    return [{ id: key, ip: hostItem.host.bk_host_innerip, inIdlePool }];
  });
}

/**
 * Filter the tree data by keyword
 *
 * @export
 * @param {TreeData[]} tree
 * @param {string} keyword
 * @return {*}  {TreeData[]}
 */
export function filterTree(tree: TreeData[], keyword: string): TreeData[] {
  if (!keyword) {
    return tree;
  }

  const idsToKeep = new Set<string>();
  const lowerCaseKeyword = keyword.toLowerCase();

  const addAllDescendants = (node: TreeData) => {
    idsToKeep.add(node.key);
    if (node.children) {
      for (const child of node.children) {
        addAllDescendants(child);
      }
    }
  };

  const findAndCollect = (nodes: TreeData[], parentPath: string[]) => {
    nodes.forEach((node) => {
      const titleStr = String(node.title ?? '').toLowerCase();
      if (titleStr.includes(lowerCaseKeyword)) {
        parentPath.forEach((parentKey) => idsToKeep.add(parentKey));
        addAllDescendants(node);
      } else if (node.children) {
        findAndCollect(node.children, [...parentPath, node.key]);
      }
    });
  };

  findAndCollect(tree, []);

  if (idsToKeep.size === 0) {
    return [];
  }

  const rebuildTree = (nodes: TreeData[]): TreeData[] => {
    return nodes
      .map((node) => {
        if (!idsToKeep.has(node.key)) {
          return null;
        }
        if (node.children) {
          return { ...node, children: rebuildTree(node.children) };
        }
        return { ...node };
      })
      .filter((node): node is TreeData => node !== null);
  };

  return rebuildTree(tree);
}

/**
 * Find a node and its parents by key
 *
 * @export
 * @param {TreeData[]} nodes
 * @param {string} key
 * @param {TreeData[]} [parents=[]]
 * @return {*}  {({ node: TreeData | null, parents: TreeData[] })}
 */
export function findNodeAndParents(
  nodes: TreeData[],
  key: string,
  parents: TreeData[] = [],
): {
  node: TreeData | null;
  parents: TreeData[];
} {
  for (const node of nodes) {
    if (node.key === key) {
      return { node, parents };
    }
    if (node.children) {
      const found = findNodeAndParents(node.children, key, [...parents, node]);
      if (found.node) {
        return found;
      }
    }
  }
  return { node: null, parents: [] };
}

/**
 * Collect all keys from tree nodes recursively
 *
 * @export
 * @param {TreeData[]} nodes
 * @return {*}  {string[]}
 */
export function collectAllKeys(nodes: TreeData[]): string[] {
  const keys: string[] = [];

  const traverse = (treeNodes: TreeData[]): void => {
    treeNodes.forEach((node) => {
      keys.push(node.key);
      if (node.children && node.children.length > 0) {
        traverse(node.children);
      }
    });
  };

  traverse(nodes);
  return keys;
}

/**
 * Build the tree data from the source data and the searchValue
 *
 * @export
 * @param {*} businessTopoData
 * @param {*} idleClusterData
 * @param {string} [searchValue]
 * @return {*}  {TreeData[]}
 */
export function buildTreeData(
  businessTopoData: any,
  idleClusterData: any,
  searchValue?: string,
): TreeData[] {
  const nodeMatches = (node: RawNodeData, searchTerm: string): boolean => {
    return (
      (node.bk_inst_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (node.bk_set_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (node.bk_module_name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const buildAllChildren = (children: RawNodeData[], bizId: number): TreeData[] => {
    return children.map((child) => ({
      title: child.bk_inst_name || '',
      key: `${child.bk_obj_id}-${child.bk_inst_id}`,
      type: getNodeType(child.bk_obj_id),
      objName: child.bk_obj_name,
      children:
        child.child && child.child.length > 0 ? buildAllChildren(child.child, bizId) : undefined,
    }));
  };

  const hasMatchingDescendant = (node: RawNodeData, searchTerm: string): boolean => {
    if (nodeMatches(node, searchTerm)) return true;
    if (node.child && node.child.length > 0) {
      return node.child.some((child) => hasMatchingDescendant(child, searchTerm));
    }
    return false;
  };

  const filterTreeWithHierarchy = (
    nodes: RawNodeData[],
    searchTerm: string,
    bizId: number,
  ): TreeData[] => {
    return nodes
      .map((node) => {
        const nodeMatch = nodeMatches(node, searchTerm);
        const hasMatchingChild =
          node.child &&
          node.child.length > 0 &&
          node.child.some((child) => hasMatchingDescendant(child, searchTerm));

        if (nodeMatch || hasMatchingChild) {
          return {
            title: node.bk_inst_name || '',
            key: `${node.bk_obj_id}-${node.bk_inst_id}`,
            type: getNodeType(node.bk_obj_id),
            objName: node.bk_obj_name,
            children: nodeMatch
              ? buildAllChildren(node.child || [], bizId)
              : filterTreeWithHierarchy(node.child || [], searchTerm, bizId),
          };
        }
        return null;
      })
      .filter(Boolean) as TreeData[];
  };

  if (searchValue && searchValue.trim()) {
    const searchTerm = searchValue.trim();
    const results: TreeData[] = [];

    businessTopoData.forEach((biz: RawNodeData) => {
      const bizChildren: TreeData[] = [];
      const bizMatches = nodeMatches(biz, searchTerm);

      const idleMatches = nodeMatches(idleClusterData, searchTerm);
      const idleHasMatchingModules = idleClusterData.module
        ? idleClusterData.module.some((mod: RawNodeData) => nodeMatches(mod, searchTerm))
        : false;

      if (idleMatches || idleHasMatchingModules) {
        const idleModules = idleMatches
          ? (idleClusterData.module || []).map((mod: any) => ({
              title: mod.bk_module_name || '',
              key: `${TopoTreeNodeType.Module}-${mod.bk_module_id}`,
              type: TopoTreeNodeType.Idle,
            }))
          : (idleClusterData.module || [])
              .filter((mod: any) => nodeMatches(mod, searchTerm))
              .map((mod: any) => ({
                title: mod.bk_module_name || '',
                key: `${TopoTreeNodeType.Module}-${mod.bk_module_id}`,
                type: TopoTreeNodeType.Idle,
              }));

        bizChildren.push({
          title: idleClusterData.bk_set_name || '',
          key: `${TopoTreeNodeType.Set}-${idleClusterData.bk_set_id}`,
          type: TopoTreeNodeType.Idle,
          children: idleModules,
        });
      }

      if (biz.child && biz.child.length > 0) {
        if (bizMatches) {
          bizChildren.push(...buildAllChildren(biz.child, biz.bk_inst_id!));
        } else {
          const filteredChildren = filterTreeWithHierarchy(biz.child, searchTerm, biz.bk_inst_id!);
          bizChildren.push(...filteredChildren);
        }
      }

      const hasRegularMatches =
        biz.child &&
        biz.child.length > 0 &&
        biz.child.some((child: RawNodeData) => hasMatchingDescendant(child, searchTerm));

      if (bizMatches || idleMatches || idleHasMatchingModules || hasRegularMatches) {
        if (bizMatches && !idleMatches && !idleHasMatchingModules) {
          bizChildren.unshift({
            title: idleClusterData.bk_set_name || '',
            key: `${TopoTreeNodeType.Set}-${idleClusterData.bk_set_id}`,
            type: TopoTreeNodeType.Idle,
            children: (idleClusterData.module || []).map((mod: any) => ({
              title: mod.bk_module_name || '',
              key: `${TopoTreeNodeType.Module}-${mod.bk_module_id}`,
              type: TopoTreeNodeType.Idle,
            })),
          });
        }

        results.push({
          title: biz.bk_inst_name || '',
          key: `${biz.bk_obj_id}-${biz.bk_inst_id}`,
          type: getNodeType(biz.bk_obj_id),
          objName: biz.bk_obj_name,
          children: bizChildren,
        });
      }
    });

    return results;
  }

  return businessTopoData.map((biz: RawNodeData) => ({
    title: biz.bk_inst_name || '',
    key: `${biz.bk_obj_id}-${biz.bk_inst_id}`,
    type: getNodeType(biz.bk_obj_id),
    objName: biz.bk_obj_name,
    children: [
      {
        title: idleClusterData.bk_set_name || '',
        key: `${TopoTreeNodeType.Set}-${idleClusterData.bk_set_id}`,
        type: TopoTreeNodeType.Idle,
        children: (idleClusterData.module || []).map((mod: any) => ({
          title: mod.bk_module_name || '',
          key: `${TopoTreeNodeType.Module}-${mod.bk_module_id}`,
          type: TopoTreeNodeType.Idle,
        })),
      },
      ...buildChildrenFromData(biz.child || [], biz.bk_inst_id!),
    ],
  }));
}

/**
 * Build children from data
 *
 * @param {RawNodeData[]} children
 * @param {number} bizId
 * @return {*}  {TreeData[]}
 */
function buildChildrenFromData(children: RawNodeData[], bizId: number): TreeData[] {
  return children.map((child) => ({
    title: child.bk_inst_name || '',
    key: `${child.bk_obj_id}-${child.bk_inst_id}`,
    type: getNodeType(child.bk_obj_id),
    objName: child.bk_obj_name,
    children:
      child.child && child.child.length > 0 ? buildChildrenFromData(child.child, bizId) : undefined,
  }));
}

/**
 * Get node type
 *
 * @param {string} [bkObjId]
 * @return {*}  {TopoTreeNodeType}
 */
function getNodeType(bkObjId?: string): TopoTreeNodeType {
  let nodeType: TopoTreeNodeType | null = null;
  switch (bkObjId) {
    case 'biz':
      nodeType = TopoTreeNodeType.Biz;
      break;
    case 'set':
      nodeType = TopoTreeNodeType.Set;
      break;
    case 'module':
      nodeType = TopoTreeNodeType.Module;
      break;
    default:
      nodeType = TopoTreeNodeType.Idle;
  }
  return nodeType;
}

/**
 * Check if the host is already in the target module, set, or biz
 *
 * @param {*} hostList
 * @param {React.Key} hostId
 * @param {TreeData} moduleNode
 * @return {*}
 */
export const isHostAlreadyInTarget = (hostList: any, hostId: React.Key, moduleNode: TreeData) => {
  // The key is formatted as "<type>-<id>" (e.g., "set-1")
  const keyParts = moduleNode.key.split('-');
  if (keyParts.length !== 2) return false;

  const type = keyParts[0];
  const id = Number(keyParts[1]);
  const hostInfo = hostList.find((h: any) => h.host.bk_host_id === Number(hostId));

  if (!hostInfo) return false;

  if (type === TopoTreeNodeType.Module) {
    return hostInfo.module.some((m: any) => m.bk_module_id === id);
  }
  if (type === TopoTreeNodeType.Set) {
    return hostInfo.set.some((s: any) => s.bk_set_id === id);
  }
  if (type === TopoTreeNodeType.Biz) {
    return hostInfo.biz.some((b: any) => b.bk_biz_id === id);
  }

  return false;
};

/**
 * Get the status of the selected node to determine UI behavior
 *
 * @export
 * @param {TreeData[]} selectedNodes
 * @return {*} Object with node status flags
 */
export function getSelectedNodeStatus(selectedNodes: TreeData[]) {
  if (!selectedNodes || selectedNodes.length === 0) {
    return {
      isModule: false,
      isIdle: false,
    };
  }
  const node = selectedNodes[0];
  const backendType = node.backendType || '';

  return {
    isModule: node.type === TopoTreeNodeType.Module,
    isIdle: node.type === TopoTreeNodeType.Idle || backendType.startsWith('idle_'),
  };
}

/**
 * Get selected nodes by their keys
 *
 * @param keys The keys of the selected nodes
 * @param tree The tree data to search
 * @returns {TreeData[]} The selected nodes
 */
export const getSelectedNodesByKeys = (keys: string[], tree: TreeData[]): TreeData[] => {
  const result: TreeData[] = [];
  const traverse = (nodes: TreeData[]) => {
    nodes.forEach((node) => {
      if (node.type === TopoTreeNodeType.Module && keys.includes(node.key)) {
        result.push(node);
      }
      if (node.children) traverse(node.children);
    });
  };
  traverse(tree);
  return result;
};

/**
 * Get the text of the host record based on the copied key.
 *
 * @param record Single host record
 * @param copyKey Copy menu option key
 * @returns Return the text to be copied; return an empty string if no corresponding data exists
 */
export function getHostCopyValue(record: any, copyKey: HostCopyKey): string {
  switch (copyKey) {
    case HostCopyKey.Id:
      return String(record.host.bk_host_id);
    case HostCopyKey.IPv4:
      return record.host.bk_host_innerip || '';
    case HostCopyKey.IPv6:
      return record.host.bk_host_innerip_v6 || '--';
    case HostCopyKey.CloudRegion: {
      const cloud = record.host.bk_cloud_id?.[0];
      return cloud ? `${cloud.bk_inst_name}[${cloud.bk_inst_id}]` : '';
    }
    case HostCopyKey.ModuleName: {
      const mod = record.module?.[0];
      return mod ? mod.bk_module_name : '';
    }
    case HostCopyKey.SetName: {
      const set = record.set?.[0];
      return set ? set.bk_set_name : '';
    }
    case HostCopyKey.CloudIdIPv4: {
      const cloud = record.host.bk_cloud_id?.[0];
      return cloud ? `${cloud.bk_inst_id}:${record.host.bk_host_innerip || ''}` : '';
    }
    case HostCopyKey.CloudIdIPv6: {
      const cloud = record.host.bk_cloud_id?.[0];
      return cloud ? `${cloud.bk_inst_id}:[${record.host.bk_host_innerip_v6 || '--'}]` : '';
    }
    case HostCopyKey.CloudIdIPIPv4First: {
      const cloud = record.host.bk_cloud_id?.[0];
      if (!cloud) return '';
      const ipv4 = record.host.bk_host_innerip;
      const ipv6 = record.host.bk_host_innerip_v6;
      if (ipv4) {
        return `${cloud.bk_inst_id}:${ipv4}`;
      }
      if (ipv6) {
        return `${cloud.bk_inst_id}:[${ipv6}]`;
      }
      return '';
    }
    case HostCopyKey.CloudIdIPIPv6First: {
      const cloud = record.host.bk_cloud_id?.[0];
      if (!cloud) return '';
      const ipv4 = record.host.bk_host_innerip;
      const ipv6 = record.host.bk_host_innerip_v6;
      if (ipv6) {
        return `${cloud.bk_inst_id}:[${ipv6}]`;
      }
      if (ipv4) {
        return `${cloud.bk_inst_id}:${ipv4}`;
      }
      return '';
    }
    default:
      return '';
  }
}

/**
 * Create a default ID property for the given object type
 *
 * @param objId The object type ID (e.g., 'biz', 'set', 'host', 'project')
 * @returns A Property object representing the ID property
 */
export function createIdProperty(objId: string) {
  const keyMap: Record<string, string> = {
    [BUILTIN_MODELS.BUSINESS]: BUILTIN_MODEL_PROPERTY_KEYS[BUILTIN_MODELS.BUSINESS].ID,
    [BUILTIN_MODELS.BUSINESS_SET]: BUILTIN_MODEL_PROPERTY_KEYS[BUILTIN_MODELS.BUSINESS_SET].ID,
    [BUILTIN_MODELS.HOST]: BUILTIN_MODEL_PROPERTY_KEYS[BUILTIN_MODELS.HOST].ID,
    [BUILTIN_MODELS.PROJECT]: BUILTIN_MODEL_PROPERTY_KEYS[BUILTIN_MODELS.PROJECT].ID,
  };
  return {
    id: Date.now(),
    bk_obj_id: objId,
    bk_property_id: keyMap[objId] || 'bk_inst_id',
    bk_property_name: 'ID',
    bk_property_index: -1,
    bk_property_type: 'int',
    isonly: true,
    ispre: true,
    bk_isapi: true,
    bk_issystem: true,
    isreadonly: true,
    editable: false,
    bk_property_group: null,
    _is_inject_: true,
  };
}

/**
 * Compare two arrays of selected properties and determine which properties were added or removed.
 *
 * @param val The current array of selected properties
 * @param oldVal The previous array of selected properties
 * @returns An object containing two arrays: addSelect and deleteSelect
 */
export const getConditionSelect = (
  val: Property[],
  oldVal: Property[],
): {
  addSelect: Property[];
  deleteSelect: Property[];
} => {
  // Newly added properties
  const addSelect: Property[] = [];
  // Removed properties
  const deleteSelect: Property[] = [];
  const selectedSet = new Set();

  // 1. Build a set of the current selected properties for quick lookup
  val.forEach((property) => selectedSet.add(`${property.bk_property_id}-${property.bk_obj_id}`));

  // 2. Find properties to remove
  oldVal.forEach((property) => {
    const { bk_property_id: propertyId, bk_obj_id: modelId } = property;
    const key = `${propertyId}-${modelId}`;
    if (selectedSet.has(key)) {
      // Remove existing property from the set
      selectedSet.delete(key);
    } else {
      // Add to delete list
      deleteSelect.push(property);
    }
  });

  // 3. The remaining properties are newly added
  val.forEach((property) => {
    const { bk_property_id: propertyId, bk_obj_id: modelId } = property;
    const key = `${propertyId}-${modelId}`;
    if (selectedSet.has(key)) {
      addSelect.push(property);
    }
  });

  return {
    addSelect,
    deleteSelect,
  };
};

type UpdateMethod = 'push' | 'unshift';
/**
 * Update the selected properties array by adding and removing properties.
 *
 * @param selected The current array of selected properties
 * @param addSelect Array of properties to add
 * @param deleteSelect Array of properties to remove
 * @param updater A function to update the selected properties state
 * @param type Method to add new properties ('push' to end, 'unshift' to start)
 */
export const updatePropertySelect = (
  selected: Property[],
  addSelect: Property[],
  deleteSelect: Property[],
  updater: (newSelected: Property[]) => void,
  type: UpdateMethod = 'push',
) => {
  const newSelected = selected.slice();
  deleteSelect.forEach((property) => {
    const index = selected.findIndex((target) => target.id === property.id);
    if (index > -1) {
      newSelected.splice(index, 1);
    }
  });
  let start = 0;
  const limit = 10;
  while (start < addSelect.length) {
    setTimeout(() => newSelected[type](...addSelect.splice(0, limit)));
    start += limit;
  }
  updater(newSelected);
};

/**
 * Transform the conditions object into the format required for dynamic group creation.
 *
 * @param conditions The conditions object that users have set
 * @returns An object containing two arrays: condition (immutable conditions) and variable_condition (variable conditions)
 */
export const formatDynamicConditions = (conditions: Record<string, Condition>) => {
  const conditionMap: Record<string, DynamicGroupConditionGroup> = {};
  const variableConditionMap: Record<string, DynamicGroupConditionGroup> = {};

  Object.values(conditions).forEach((cond) => {
    const { property, operator, value } = cond;
    const objId = property.bk_obj_id;
    const field = property.bk_property_id;

    const conditionItem: DynamicGroupCondition = {
      field,
      operator,
      value,
    };

    if (property.conditionType === ConditionType.IMMUTABLE) {
      // immutable conditions
      if (!conditionMap[objId]) {
        conditionMap[objId] = {
          bk_obj_id: objId,
          condition: [],
        };
      }
      conditionMap[objId].condition.push(conditionItem);
    } else {
      // variable conditions
      if (!variableConditionMap[objId]) {
        variableConditionMap[objId] = {
          bk_obj_id: objId,
          condition: [],
        };
      }
      variableConditionMap[objId].condition.push(conditionItem);
    }
  });

  // transform the map to an array
  const conditionArray = Object.values(conditionMap);
  const variableConditionArray = Object.values(variableConditionMap);

  return {
    condition: conditionArray,
    variable_condition: variableConditionArray,
  };
};

/**
 * Validate if the condition value is valid
 * @param value
 * @returns
 */
export const isValidCondition = (value: any): boolean => {
  if (value === undefined || value === null || value === '') {
    return false;
  }
  if (Array.isArray(value) && value.length === 0) {
    return false;
  }
  return true;
};

/**
 * Process condition groups and extract properties with conditions
 * @param conditionGroups - Array of condition groups from API
 * @param conditionType - The type of condition (VARIABLE or IMMUTABLE)
 * @param propertyMap - Map of object ID to properties
 * @returns Object containing selectedProperties and storageConditions
 */
export const processConditionGroups = (
  conditionGroups: DynamicGroupConditionGroup[],
  conditionType: ConditionType,
  propertyMap: Record<string, Property[]>,
): {
  selectedProperties: Property[];
  storageConditions: Record<string, Condition>;
} => {
  const selectedProperties: Property[] = [];
  const storageConditions: Record<string, Condition> = {};

  // Track properties that might have range conditions (gte + lte)
  const rangeConditions: Record<string, DynamicGroupCondition & { property: Property }> = {};
  // Track processed properties to avoid duplicates
  const processedPropertyIds = new Set<number>();
  // Track range properties that have been added to maintain order
  const rangePropertiesAdded = new Set<string>();

  conditionGroups.forEach((conditionGroup: DynamicGroupConditionGroup) => {
    const objId = conditionGroup.bk_obj_id;
    const properties = propertyMap[objId] || [];

    // Process regular conditions in their original order
    conditionGroup.condition?.forEach((cond: DynamicGroupCondition) => {
      const property = properties.find((p) => p.bk_property_id === cond.field);

      if (property) {
        const propertyKey = `${objId}_${cond.field}`;

        // Handle range conditions ($gte and $lte)
        if (cond.operator === QUERY_OPERATOR.GTE || cond.operator === QUERY_OPERATOR.LTE) {
          if (!rangeConditions[propertyKey]) {
            rangeConditions[propertyKey] = {
              field: cond.field,
              operator: QUERY_OPERATOR.RANGE as OperatorType,
              value: [],
              property,
            };
          }

          if (cond.operator === QUERY_OPERATOR.GTE) {
            rangeConditions[propertyKey].value[0] = cond.value;
          } else if (cond.operator === QUERY_OPERATOR.LTE) {
            rangeConditions[propertyKey].value[1] = cond.value;
          }

          // Add the property immediately when first encountered (on $gte or if $lte comes first)
          if (!rangePropertiesAdded.has(propertyKey) && !processedPropertyIds.has(property.id)) {
            const propertyWithType = {
              ...property,
              conditionType,
            };

            selectedProperties.push(propertyWithType);
            processedPropertyIds.add(property.id);
            rangePropertiesAdded.add(propertyKey);

            // Store the range condition immediately
            storageConditions[property.id] = {
              property: propertyWithType,
              operator: QUERY_OPERATOR.RANGE as OperatorType,
              value: rangeConditions[propertyKey].value,
            };
          } else if (rangePropertiesAdded.has(propertyKey)) {
            // Update the existing condition value when the second part of range is encountered
            storageConditions[property.id] = {
              ...storageConditions[property.id],
              value: rangeConditions[propertyKey].value,
            };
          }
        } else {
          // Handle regular conditions
          if (!processedPropertyIds.has(property.id)) {
            const propertyWithType = {
              ...property,
              conditionType,
            };

            selectedProperties.push(propertyWithType);
            processedPropertyIds.add(property.id);

            // Store regular condition
            storageConditions[property.id] = {
              property: propertyWithType,
              operator: cond.operator as OperatorType,
              value: cond.value,
            };
          }
        }
      }
    });

    // Then, process time_condition
    if (conditionGroup.time_condition) {
      const { rules } = conditionGroup.time_condition;

      rules.forEach((rule) => {
        const { field, start, end } = rule;
        const property = properties.find((p) => p.bk_property_id === field);

        if (property && !processedPropertyIds.has(property.id)) {
          const propertyWithType = {
            ...property,
            conditionType,
          };

          selectedProperties.push(propertyWithType);
          processedPropertyIds.add(property.id);

          // Store time range as array [start, end]
          storageConditions[property.id] = {
            property: propertyWithType,
            operator: QUERY_OPERATOR.RANGE as OperatorType,
            value: [start, end],
          };
        }
      });
    }
  });

  return { selectedProperties, storageConditions };
};
