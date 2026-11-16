export default function MiniRoute({
    pickup,
    dropoff,
    waypoints = 0,
}: {
    pickup: string;
    dropoff: string;
    waypoints?: number;
}) {
    return (
        <div className="mini-route">
            <span className="mini-route-node is-pickup" aria-hidden="true">
                <i />
            </span>
            <span className="mini-route-text">{pickup}</span>
            {waypoints > 0 && (
                <>
                    <span className="mini-route-stem" aria-hidden="true" />
                    <span />
                    <span className="mini-route-node is-waypoint" aria-hidden="true">
                        <i />
                    </span>
                    <span className="mini-route-text is-muted">
                        +{waypoints} {waypoints === 1 ? "parada" : "paradas"}
                    </span>
                </>
            )}
            <span className="mini-route-stem" aria-hidden="true" />
            <span />
            <span className="mini-route-node is-dropoff" aria-hidden="true">
                <i />
            </span>
            <span className="mini-route-text">{dropoff}</span>
        </div>
    );
}
