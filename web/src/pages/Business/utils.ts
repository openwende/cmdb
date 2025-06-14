import { TreeData } from "./Types";

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
 * Traverses a tree structure to locate a node by its key and returns both the node
 * and an array of keys representing its parent path
 * 
 * @param tree 
 * @param key 
 * @returns 
 */
export function findNodeAndParents(tree: TreeData[], key: string): { node: TreeData | null, parentKeys: string[] } {
    let found: TreeData | null = null;
    let parents: string[] = [];
    function dfs(nodes: TreeData[], path: string[]) {
        for (const node of nodes) {
            if (node.key === key) {
                found = node;
                parents = path;
                return true;
            }
            if (node.children && dfs(node.children, [...path, node.key])) {
                return true;
            }
        }
        return false;
    }
    dfs(tree, []);
    return { node: found, parentKeys: parents };
}