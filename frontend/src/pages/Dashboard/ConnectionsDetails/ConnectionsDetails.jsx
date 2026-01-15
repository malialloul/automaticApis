import { DatabaseBreakdown } from "./DatabaseBreakdown"
import { Header } from "./Header"
import { KeyMetrics } from "./KeyMetrics"
import { QuickActions } from "./QuickActions"

export const ConnectionsDetails = ({ refreshSchemas, connections, scope, setScope, displayStats, loadingStats, statsById, setConfirm }) => {
    return (
        <>
            <Header scope={scope} setScope={setScope} />
            <KeyMetrics displayStats={displayStats} loadingStats={loadingStats} />
            <DatabaseBreakdown refreshSchemas={refreshSchemas} connections={connections} scope={scope} statsById={statsById} loadingStats={loadingStats} setConfirm={setConfirm} />
            <QuickActions />
        </>
    )
}