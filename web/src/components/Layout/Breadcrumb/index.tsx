import React, { Fragment } from 'react';
import { Breadcrumb as AntBreadcrumb } from 'antd';
import './style.css';
import { NavigationItem } from '../../../routes/Types';

interface BreadcrumbProps {
    currentSection: NavigationItem | undefined;
}

const Breadcrumb: React.FC<BreadcrumbProps> = ({ currentSection }) => {
    const sidebarItems = currentSection?.children || [];

    // Get the currently selected sidebar item
    const getSelectedName = () => {
        const path = location.pathname;
        if (sidebarItems.length > 0) {
            const selectedItem = sidebarItems.find(item => item.path === path);
            return selectedItem ? selectedItem.name : '';
        }
        return '';
    };

    const selectedName = getSelectedName();

    return <Fragment>
        {selectedName ? <AntBreadcrumb className="app-breadcrumb" items={[{ title: selectedName }]} /> : null}
    </Fragment>
}

export default Breadcrumb;