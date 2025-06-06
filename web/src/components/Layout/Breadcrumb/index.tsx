import React, { Fragment, useEffect, useState } from 'react';
import { Breadcrumb as AntBreadcrumb } from 'antd';
import type { ItemType as AntdBreadcrumbItemType } from 'antd/es/breadcrumb/Breadcrumb';
import { useLocation, useNavigate, useMatches, Link, UIMatch } from 'react-router-dom';
import { NavigationItem } from '../../../routes/Types';
import './style.css';

const Breadcrumb: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const matches = useMatches();

    const [breadcrumbItems, setBreadcrumbItems] = useState<AntdBreadcrumbItemType[]>([]);

    useEffect(() => {
        let items: AntdBreadcrumbItemType[] = [];

        matches.forEach((match: UIMatch<unknown, unknown>, index: number) => {
            const routeConfig = (match.handle as { navigationItem: NavigationItem })?.navigationItem;

            if (!routeConfig) {
                return;
            }

            // Filter out the root route
            if (index === 0) {
                return;
            }

            // Handle routes at the second level and below
            if (index >= 2) {
                const isLastItem = index === matches.length - 1;
                const title = routeConfig.name;
                const linkPath = match.pathname + location.search;

                items.push({
                    key: `breadcrumb-${routeConfig.key}-${index}`,
                    title: isLastItem ? title : <Link to={linkPath}>{title}</Link>,
                });
            }
        });

        setBreadcrumbItems(items);
    }, [location, matches, navigate]);

    return (
        <Fragment>
            {breadcrumbItems.length > 0 ? (
                <AntBreadcrumb className="app-breadcrumb" items={breadcrumbItems} />
            ) : null}
        </Fragment>
    );
};

export default Breadcrumb;