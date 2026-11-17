import { Truck } from "lucide-react";
import { Link } from "react-router-dom";
import { messageFor } from "../../api/errors";
import type { ApiError } from "../../api/http";
import type { OrderDetail } from "../../api/types";
import { ErrorState, Skeleton } from "../../components/blocks";
import { formatDateTime } from "../../components/format";
import { badgeEntry } from "../../components/StatusBadge";
import { SidePanel } from "../../patterns/SidePanel";
import StopTimeline, { timelineFromOrder, timelineFromRoute } from "../../patterns/StopTimeline";
import { initials } from "../liveMapScene";
import { useOrder, useOrderRoute } from "./orderQueries";

const ACTIVE = new Set(["DISPATCHED", "DRIVER_ENROUTE", "ARRIVED", "IN_PROGRESS"]);

export function BigStatus({ status }: { status: OrderDetail["status"] }) {
    const { label, tone } = badgeEntry("order", status);
    return (
        <div className={`big-status tone-${tone}${ACTIVE.has(status) ? " is-live" : ""}`}>
            <span className="big-status-dot" aria-hidden="true" />
            <b>{label}</b>
        </div>
    );
}

function Person({ role, name }: { role: string; name: string }) {
    return (
        <li className="op-person">
            <span className="op-avatar" aria-hidden="true">
                {initials(name)}
            </span>
            <span>
                <small>{role}</small>
                <b>{name}</b>
            </span>
        </li>
    );
}

export default function OrderPreview({
    id,
    trackingNumber,
    isStaff,
    onClose,
}: {
    id: string;
    trackingNumber: string;
    isStaff: boolean;
    onClose: () => void;
}) {
    const order = useOrder(id);
    const route = useOrderRoute(id, isStaff);
    const o = order.data;
    const stops =
        route.data && route.data.stops.length > 0
            ? timelineFromRoute(route.data.stops)
            : o
              ? timelineFromOrder(o)
              : [];
    const waitingRoute = isStaff && route.isLoading;

    return (
        <SidePanel
            title={trackingNumber}
            onClose={onClose}
            footer={
                <Link className="btn btn-primary" to={`/orders/${id}`}>
                    Abrir pedido
                </Link>
            }
        >
            {order.isError ? (
                <ErrorState
                    message={messageFor(
                        (order.error as ApiError).code,
                        (order.error as ApiError).message,
                    )}
                    onRetry={() => order.refetch()}
                />
            ) : !o ? (
                <div className="op-loading">
                    <Skeleton height={34} width={200} />
                    <Skeleton height={14} width={160} />
                    <Skeleton height={180} />
                </div>
            ) : (
                <div className="op-body">
                    <section className="op-head">
                        <BigStatus status={o.status} />
                        <p className="op-when">
                            Criado {formatDateTime(o.createdAt)}
                            {o.finishedAt && ` · finalizado ${formatDateTime(o.finishedAt)}`}
                        </p>
                    </section>
                    {isStaff && (
                        <section aria-label="Envolvidos">
                            <ul className="op-people">
                                {o.customer && <Person role="Cliente" name={o.customer.name} />}
                                {o.driver && <Person role="Motorista" name={o.driver.name} />}
                                {o.vehicle && (
                                    <li className="op-person">
                                        <span className="op-avatar is-plate" aria-hidden="true">
                                            <Truck size={16} />
                                        </span>
                                        <span>
                                            <small>Veículo</small>
                                            <b className="data">{o.vehicle.plate}</b>
                                        </span>
                                    </li>
                                )}
                            </ul>
                        </section>
                    )}
                    <section className="op-stops">
                        <span className="micro">Paradas</span>
                        {waitingRoute ? <Skeleton height={160} /> : <StopTimeline stops={stops} />}
                    </section>
                </div>
            )}
        </SidePanel>
    );
}
