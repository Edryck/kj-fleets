import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, TriangleAlert, WifiOff } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { messageFor } from "../api/errors";
import { ApiError, request } from "../api/http";
import type { DriverStatus, Driver, OrderRoute, OrderSummary, Page, RouteStop } from "../api/types";
import { useSession } from "../auth/session";
import { EmptyState, ErrorState, Skeleton } from "../components/blocks";
import { formatAgo } from "../components/format";
import MapView, { stopMarkers, type MapMarker } from "../components/MapView";
import StatusBadge from "../components/StatusBadge";
import { useConnectionState, useTopic, type LocationEvent } from "../realtime/useTopic";

const STATUSES: [DriverStatus, string][] = [
    ["AVAILABLE", "Disponível"],
    ["BUSY", "Ocupado"],
    ["OFFLINE", "Offline"],
];

const initials = (name: string) =>
    name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join("");

// a API limita a página em 100; junta todas até o total
async function loadAllDrivers(): Promise<Driver[]> {
    const all: Driver[] = [];
    for (;;) {
        const page = await request<Page<Driver>>("GET", "/drivers", undefined, {
            limit: 100,
            offset: all.length,
        });
        all.push(...page.items);
        if (all.length >= page.total || page.items.length === 0) return all;
    }
}

interface FleetStatusRows {
    drivers?: { driverId: string; pingStale: boolean }[];
}

export default function LiveMap() {
    const client = useQueryClient();
    const session = useSession();
    const connection = useConnectionState();
    const [search, setSearch] = useState("");
    const [statuses, setStatuses] = useState<DriverStatus[]>([]);
    const [fleetId, setFleetId] = useState("");
    const [selectedId, setSelectedId] = useState<string | null>(null);
    // só para os "há N s" andarem sem refetch
    const [now, setNow] = useState(Date.now);
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 10000);
        return () => clearInterval(timer);
    }, []);

    const drivers = useQuery({ queryKey: ["drivers", "map"], queryFn: loadAllDrivers });

    // despachante não recebe drivers[] aqui; sem isso só some a marca "Sem sinal"
    const stale = useQuery({
        queryKey: ["dashboard", "fleet-status", "map"],
        queryFn: () => request<FleetStatusRows>("GET", "/dashboard/fleet/status"),
        enabled: session?.role !== "DISPATCHER",
    });
    const staleIds = useMemo(
        () => new Set(stale.data?.drivers?.filter((d) => d.pingStale).map((d) => d.driverId)),
        [stale.data],
    );

    useTopic<LocationEvent>("/topic/fleet/locations", (e) => {
        const cached = client.getQueryData<Driver[]>(["drivers", "map"]);
        // motorista que ainda não estava na lista (recém-criado): recarrega
        if (cached && !cached.some((d) => d.publicId === e.driverId)) {
            void client.invalidateQueries({ queryKey: ["drivers", "map"] });
            return;
        }
        client.setQueryData<Driver[]>(["drivers", "map"], (list) =>
            list?.map((d) =>
                d.publicId !== e.driverId
                    ? d
                    : {
                          ...d,
                          status: e.status,
                          ...(e.lat != null && e.lng != null
                              ? { lat: e.lat, lng: e.lng, lastSeenAt: e.at }
                              : {}),
                      },
            ),
        );
    });

    const all = useMemo(() => drivers.data ?? [], [drivers.data]);
    const fleets = useMemo(() => {
        const byId = new Map<string, string>();
        all.forEach((d) => d.fleets.forEach((f) => byId.set(f.publicId, f.name)));
        return [...byId].sort((a, b) => a[1].localeCompare(b[1]));
    }, [all]);

    const q = search.trim().toLowerCase();
    const matches = (d: Driver, withStatus: boolean) =>
        (!withStatus || statuses.length === 0 || statuses.includes(d.status)) &&
        (!fleetId || d.fleets.some((f) => f.publicId === fleetId)) &&
        (!q ||
            d.name.toLowerCase().includes(q) ||
            (d.vehicle?.plate.toLowerCase().includes(q) ?? false));
    const visible = all.filter((d) => matches(d, true));
    const counts = (status: DriverStatus) =>
        all.filter((d) => matches(d, false) && d.status === status).length;

    const selected = all.find((d) => d.publicId === selectedId) ?? null;
    const activeOrder = useQuery({
        queryKey: ["orders", "active", selectedId],
        queryFn: () =>
            request<Page<OrderSummary>>("GET", "/orders", undefined, {
                driverId: selectedId!,
                active: true,
                limit: 1,
            }),
        enabled: !!selectedId,
    });
    const orderId = activeOrder.data?.items[0]?.publicId;
    const route = useQuery({
        queryKey: ["order", orderId, "route"],
        queryFn: () =>
            request<OrderRoute>("GET", `/orders/${orderId}/route`).catch((e: ApiError) => {
                if (e.code === "ROUTE_NOT_FOUND") return null;
                throw e;
            }),
        enabled: !!orderId,
    });
    const stops: RouteStop[] = route.data?.stops ?? [];

    const markers = useMemo<MapMarker[]>(() => {
        const list: MapMarker[] = visible
            .filter((d) => d.lat != null && d.lng != null)
            .map((d) => ({
                id: d.publicId,
                kind: "driver",
                lat: d.lat!,
                lng: d.lng!,
                status: d.status,
                label: initials(d.name),
                title: [d.name, d.vehicle?.plate, formatAgo(d.lastSeenAt, now)]
                    .filter(Boolean)
                    .join(" · "),
                selected: d.publicId === selectedId,
            }));
        return [...stopMarkers(stops), ...list];
        // eslint-disable-next-line react-hooks/exhaustive-deps -- visible deriva de all/filtros; stops de route.data
    }, [all, statuses, fleetId, q, selectedId, route.data, now]);

    if (drivers.isError) {
        const error = drivers.error as ApiError;
        return (
            <ErrorState
                message={messageFor(error.code, error.message)}
                onRetry={() => drivers.refetch()}
            />
        );
    }

    const toggle = (status: DriverStatus) =>
        setStatuses((s) => (s.includes(status) ? s.filter((x) => x !== status) : [...s, status]));

    return (
        <div className="stack">
            <header className="page-head">
                <div>
                    <h1>Mapa ao vivo</h1>
                    <p className="page-sub">Onde está cada motorista agora.</p>
                </div>
            </header>

            {connection !== "connected" && (
                <p className="notice notice-warning" role="status">
                    <WifiOff size={14} aria-hidden="true" />{" "}
                    {connection === "reconnecting"
                        ? "Reconectando. As posições podem estar desatualizadas."
                        : "Sem conexão em tempo real. As posições podem estar desatualizadas."}
                </p>
            )}

            {drivers.isSuccess && all.length === 0 ? (
                <EmptyState
                    title="Nenhum motorista cadastrado"
                    description="Cadastre motoristas para acompanhá-los aqui."
                    action={
                        <Link className="btn btn-secondary" to="/drivers">
                            Ir para motoristas
                        </Link>
                    }
                />
            ) : (
                <div className="live-map">
                    <MapView
                        className="live-map-canvas"
                        markers={markers}
                        line={stops.length > 1}
                        onMarkerClick={(id) =>
                            all.some((d) => d.publicId === id) && setSelectedId(id)
                        }
                        focusId={selectedId}
                    />
                    <aside className="live-panel card" aria-label="Motoristas">
                        <label className="search-field">
                            <Search size={16} aria-hidden="true" />
                            <input
                                type="search"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Buscar por nome ou placa"
                                aria-label="Buscar motoristas"
                            />
                        </label>
                        <div className="chips" role="group" aria-label="Status">
                            {STATUSES.map(([value, label]) => (
                                <button
                                    key={value}
                                    type="button"
                                    className="chip live-chip"
                                    aria-pressed={statuses.includes(value)}
                                    onClick={() => toggle(value)}
                                >
                                    <span
                                        className="map-marker map-marker-driver live-swatch"
                                        data-status={value}
                                        aria-hidden="true"
                                    />
                                    {label}
                                    <span className="data">{counts(value)}</span>
                                </button>
                            ))}
                        </div>
                        {fleets.length > 0 && (
                            <label className="inline-field caption">
                                Frota
                                <select
                                    value={fleetId}
                                    onChange={(e) => setFleetId(e.target.value)}
                                >
                                    <option value="">Todas</option>
                                    {fleets.map(([id, name]) => (
                                        <option key={id} value={id}>
                                            {name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        )}

                        {selected && (
                            <section className="live-selected" aria-label="Motorista escolhido">
                                <div className="live-selected-head">
                                    <Link to={`/drivers/${selected.publicId}`}>
                                        {selected.name}
                                    </Link>
                                    <StatusBadge kind="driver" value={selected.status} />
                                </div>
                                <dl className="dl">
                                    <div>
                                        <dt>Placa</dt>
                                        <dd className={selected.vehicle ? "data" : undefined}>
                                            {selected.vehicle?.plate ?? "—"}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt>Último sinal</dt>
                                        <dd>
                                            {formatAgo(selected.lastSeenAt, now)}
                                            {staleIds.has(selected.publicId) && (
                                                <span className="badge badge-warning live-stale">
                                                    <TriangleAlert size={14} aria-hidden="true" />
                                                    Sem sinal
                                                </span>
                                            )}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt>Pedido ativo</dt>
                                        <dd>
                                            {activeOrder.data?.items[0] ? (
                                                <Link
                                                    className="data"
                                                    to={`/orders/${activeOrder.data.items[0].publicId}`}
                                                >
                                                    {activeOrder.data.items[0].trackingNumber}
                                                </Link>
                                            ) : (
                                                "—"
                                            )}
                                        </dd>
                                    </div>
                                </dl>
                                {selected.lat == null && (
                                    <p className="caption">Ainda sem posição enviada.</p>
                                )}
                                <button
                                    type="button"
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => setSelectedId(null)}
                                >
                                    Fechar
                                </button>
                            </section>
                        )}

                        {drivers.isLoading ? (
                            <div className="stack-sm">
                                <Skeleton height={44} />
                                <Skeleton height={44} />
                                <Skeleton height={44} />
                            </div>
                        ) : visible.length === 0 ? (
                            <p className="caption">Nenhum motorista com esses filtros.</p>
                        ) : (
                            <ul className="live-list">
                                {visible.map((d) => (
                                    <li key={d.publicId}>
                                        <button
                                            type="button"
                                            aria-pressed={d.publicId === selectedId}
                                            onClick={() => setSelectedId(d.publicId)}
                                        >
                                            <span
                                                className="map-marker map-marker-driver live-swatch"
                                                data-status={d.status}
                                                aria-hidden="true"
                                            >
                                                {initials(d.name)}
                                            </span>
                                            <span className="live-who">
                                                <span className="live-name">{d.name}</span>
                                                <span className="caption">
                                                    <span className="data">
                                                        {d.vehicle?.plate ?? "Sem veículo"}
                                                    </span>
                                                    {" · "}
                                                    {d.lat == null
                                                        ? "Sem posição"
                                                        : formatAgo(d.lastSeenAt, now)}
                                                </span>
                                            </span>
                                            <StatusBadge kind="driver" value={d.status} />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </aside>
                </div>
            )}
        </div>
    );
}
