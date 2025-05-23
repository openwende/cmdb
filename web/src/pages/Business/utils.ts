 // Transter the input data into the format which Cascader need
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