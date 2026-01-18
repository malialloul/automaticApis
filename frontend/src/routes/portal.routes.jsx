import { Navigate, Route, Routes } from "react-router-dom"
import Documentation from "../pages/Documentation"
import { useConnection } from "../_shared/database/useConnection"
import DashboardPage from "../pages/Dashboard/Dashboard"
import Schema from "../pages/Schema/Schema"
import ERDiagramViewer from "../pages/ErDiagram/ERDiagramViewer"
import APIs from "../pages/APIs/APIs"
import SchemaBuilder from "../pages/SchemaBuilder/SchemaBuilder"

export const PortalRoutesPaths = {
    DASHBOARD: "/dashboard",
    SCHEMA: "/schema",
    SCHEMA_BUILDER: "/schema-builder",
    ER_DIAGRAM: "/er-diagram",
    DB_APIS: "/db-apis",
    DOCUMENTATION: "/documentation",
}

export const PortalRoutes = () => {
    const {
        currentConnection,
    } = useConnection();

    return (
        <Routes>
            <Route path={PortalRoutesPaths.DASHBOARD} element={<DashboardPage />} />
            <Route
                path={PortalRoutesPaths.SCHEMA}
                element={<Schema />}
            />
            <Route
                path={PortalRoutesPaths.SCHEMA_BUILDER}
                element={<SchemaBuilder />}
            />
            <Route
                path={PortalRoutesPaths.ER_DIAGRAM}
                element={<ERDiagramViewer />}
            />
            <Route
                path={PortalRoutesPaths.DB_APIS}
                element={<APIs />}
            />
            <Route
                path={PortalRoutesPaths.DOCUMENTATION}
                element={
                    currentConnection ? (
                        <Documentation />
                    ) : (
                        <Navigate
                            to={PortalRoutesPaths.DASHBOARD}
                            replace
                            state={{ notice: "Connect to a database to view Docs." }}
                        />
                    )
                }
            />
        </Routes>
    )
}