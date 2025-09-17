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
        const items: AntdBreadcrumbItemType[] = [];

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

                // Check if current route is an index route
                const isIndexRoute = routeConfig.index === true;

                // For index routes, only show parent name non-clickable
                if (isIndexRoute) {
                    // Find the parent route by looking at the previous match
                    const parentMatch = matches[index - 1];
                    const parentHandle = parentMatch?.handle as { navigationItem: NavigationItem };
                    const parentRouteConfig = parentHandle?.navigationItem;

                    // Only add parent route if it hasn't been added already
                    const parentAlreadyAdded = items.some(item =>
                        item.key === `breadcrumb-${parentRouteConfig?.key}-${index - 1}`
                    );

                    if (parentRouteConfig?.name && !parentAlreadyAdded) {
                        items.push({
                            key: `breadcrumb-${parentRouteConfig.key}-${index}`,
                            title: parentRouteConfig.name,
                        });
                    }
                    return;
                }

                // Check if next route is an index route
                const nextMatch = matches[index + 1];
                const nextHandle = nextMatch?.handle as { navigationItem: NavigationItem };
                const nextRouteConfig = nextHandle?.navigationItem;
                const nextIsIndexRoute = nextRouteConfig?.index === true;

                // Normal route handling
                if (title) {
                    items.push({
                        key: `breadcrumb-${routeConfig.key}-${index}`,
                        title: (isLastItem || nextIsIndexRoute)
                            ? title
                            : <Link to={linkPath} className='item-link'>{title}</Link>,
                    });
                }
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