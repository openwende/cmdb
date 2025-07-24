import React from "react";
import { Outlet, useMatch } from "react-router-dom";
import BusinessList from "./BusinessList";

export const archivedBusinessPath = '/resource/business/archivedBusiness';

const ResourceBusiness: React.FC = () => {
    const isArchivedBusinessRoute = useMatch(archivedBusinessPath);

    return (
        <>
            {isArchivedBusinessRoute ? <Outlet /> : <BusinessList />}
        </>
    );
}

export default ResourceBusiness;