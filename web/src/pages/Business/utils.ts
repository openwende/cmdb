import { RawNodeData, TopoTreeNodeType, TreeData } from "./Types";

/**
 * Transter the input data into the format which Cascader need
 * 
 * @param serviceCategory 
 * @returns 
 */
export function buildCascaderOptions(serviceCategory: any[]) {
    return serviceCategory
        .filter(c => c.category.bk_parent_id === 0)
        .map(parent => ({
            value: parent.category.id,
            label: parent.category.name,
            children: serviceCategory
                .filter(child => child.category.bk_parent_id === parent.category.id)
                .map(child => ({
                    value: child.category.id,
                    label: child.category.name
                }))
        }));
}

/**
 * Get the formatted topo_path for the selected node
 * 
 * @param selectedNode The selected node object
 * @param transferTargetData The JSON data containing topology node information
 * @returns The formatted topo_path_string
 */
export function getFormattedTopoPath(
    selectedNode: TreeData | null,
    transferTargetData: any
): string {
    if (!selectedNode || !transferTargetData) {
        return "";
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
        // Extract the bk_ins_name from reversed path
        const breadcrumbParts = reversedPath.map(node => node.bk_inst_name);
        return breadcrumbParts.join(' / ');
    } else {
        return "";
    }
}

/**
 * Check whether the selected host(s) are in the idle pool
 * 
 * @param selectedRowKeys Array of selected host keys (host IDs)
 * @param allHostsData Host data
 * @param idleSetID Idle pool set ID
 * @returns Array<{ hostId: number, inIdlePool: boolean }>
 */
export function checkHostsInIdlePool(
    selectedRowKeys: React.Key[],
    allHostsData: any[],
    idleSetID: number | null
): { hostId: number, inIdlePool: boolean }[] {
    if (idleSetID == null) return selectedRowKeys.map(key => ({ hostId: Number(key), inIdlePool: false }));
    return selectedRowKeys.map(key => {
        const host = allHostsData.find(h => h.host.bk_host_id === key);
        const inIdlePool = host?.set?.some((s: any) => s.bk_set_id === idleSetID) ?? false;
        return { hostId: Number(key), inIdlePool };
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
        nodes.forEach(node => {
            const titleStr = String(node.title ?? '').toLowerCase();
            if (titleStr.includes(lowerCaseKeyword)) {
                parentPath.forEach(parentKey => idsToKeep.add(parentKey));
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
            .map(node => {
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
 * @return {*}  {({ node: TreeData | null, parentKeys: string[] })}
 */
export function findNodeAndParents(nodes: TreeData[], key: string, parents: TreeData[] = []): { node: TreeData | null, parentKeys: string[] } {
    for (const node of nodes) {
        if (node.key === key) {
            return { node, parentKeys: parents.map(p => p.key) };
        }
        if (node.children) {
            const found = findNodeAndParents(node.children, key, [...parents, node]);
            if (found.node) {
                return found;
            }
        }
    }
    return { node: null, parentKeys: [] };
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
export function buildTreeData(businessTopoData: any, idleClusterData: any, searchValue?: string): TreeData[] {
    const nodeMatches = (node: RawNodeData, searchTerm: string): boolean => {
        return (node.bk_inst_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (node.bk_set_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (node.bk_module_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    };

    const buildAllChildren = (children: RawNodeData[], bizId: number): TreeData[] => {
        return children.map((child) => ({
            title: child.bk_inst_name || '',
            key: `${child.bk_obj_id}-${child.bk_inst_id}`,
            type: getNodeType(child.bk_obj_id),
            objName: child.bk_obj_name,
            children: child.child && child.child.length > 0
                ? buildAllChildren(child.child, bizId)
                : undefined
        }));
    };

    const hasMatchingDescendant = (node: RawNodeData, searchTerm: string): boolean => {
        if (nodeMatches(node, searchTerm)) return true;
        if (node.child && node.child.length > 0) {
            return node.child.some((child) => hasMatchingDescendant(child, searchTerm));
        }
        return false;
    };

    const filterTreeWithHierarchy = (nodes: RawNodeData[], searchTerm: string, bizId: number): TreeData[] => {
        return nodes.map((node) => {
            const nodeMatch = nodeMatches(node, searchTerm);
            const hasMatchingChild = node.child && node.child.length > 0 &&
                node.child.some((child) => hasMatchingDescendant(child, searchTerm));

            if (nodeMatch || hasMatchingChild) {
                return {
                    title: node.bk_inst_name || '',
                    key: `${node.bk_obj_id}-${node.bk_inst_id}`,
                    type: getNodeType(node.bk_obj_id),
                    objName: node.bk_obj_name,
                    children: nodeMatch
                        ? buildAllChildren(node.child || [], bizId)
                        : filterTreeWithHierarchy(node.child || [], searchTerm, bizId)
                };
            }
            return null;
        }).filter(Boolean) as TreeData[];
    };

    if (searchValue && searchValue.trim()) {
        const searchTerm = searchValue.trim();
        const results: TreeData[] = [];

        businessTopoData.forEach((biz: RawNodeData) => {
            const bizChildren: TreeData[] = [];
            const bizMatches = nodeMatches(biz, searchTerm);

            const idleMatches = nodeMatches(idleClusterData, searchTerm);
            const idleHasMatchingModules = idleClusterData.module ? idleClusterData.module.some((mod: RawNodeData) => nodeMatches(mod, searchTerm)) : false;

            if (idleMatches || idleHasMatchingModules) {
                const idleModules = idleMatches
                    ? (idleClusterData.module || []).map((mod: any) => ({
                        title: mod.bk_module_name || '',
                        key: `${TopoTreeNodeType.Module}-${mod.bk_module_id}`,
                        type: TopoTreeNodeType.Idle
                    }))
                    : (idleClusterData.module || [])
                        .filter((mod: any) => nodeMatches(mod, searchTerm))
                        .map((mod: any) => ({
                            title: mod.bk_module_name || '',
                            key: `${TopoTreeNodeType.Module}-${mod.bk_module_id}`,
                            type: TopoTreeNodeType.Idle
                        }));

                bizChildren.push({
                    title: idleClusterData.bk_set_name || '',
                    key: `${TopoTreeNodeType.Set}-${idleClusterData.bk_set_id}`,
                    type: TopoTreeNodeType.Idle,
                    children: idleModules
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

            const hasRegularMatches = biz.child && biz.child.length > 0 &&
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
                            type: TopoTreeNodeType.Idle
                        }))
                    });
                }

                results.push({
                    title: biz.bk_inst_name || '',
                    key: `${biz.bk_obj_id}-${biz.bk_inst_id}`,
                    type: getNodeType(biz.bk_obj_id),
                    objName: biz.bk_obj_name,
                    children: bizChildren
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
            ...buildChildrenFromData(biz.child || [], biz.bk_inst_id!)
        ]
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
    return children.map(child => ({
        title: child.bk_inst_name || '',
        key: `${child.bk_obj_id}-${child.bk_inst_id}`,
        type: getNodeType(child.bk_obj_id),
        objName: child.bk_obj_name,
        children: child.child && child.child.length > 0
            ? buildChildrenFromData(child.child, bizId)
            : undefined
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
