import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    ArrowUpRight,
    CalendarDays,
    Clock,
    Crosshair,
    Minus,
    Plus,
    Search,
    TriangleAlert,
    WifiOff,
    X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { messageFor } from "../api/errors";
import { ApiError, request } from "../api/http";
import type { Driver, DriverStatus, OrderRoute, OrderSummary, Page, RouteStop } from "../api/types";
import { useSession } from "../auth/session";
import { EmptyState, ErrorState, Skeleton } from "../components/blocks";
import { formatAgo, formatKm, formatMinutes } from "../components/format";
import { MapLegend } from "../components/RouteLegs";
import StatusBadge from "../components/StatusBadge";
import Glass from "../glass/Glass";
import { useTitleBlock } from "../layout/titleBlockContext";
import type { Padding } from "../map/camera";
import { sendMapCommand } from "../map/sceneStore";
import { useMapScene } from "../map/useMapScene";
import { useConnectionState, useTopic, type LocationEvent } from "../realtime/useTopic";
import { vehicleRender } from "../vehicles/vehicleRender";
import { initials, liveMapScene } from "./liveMapScene";

type Filter = DriverStatus | "ALL";

const STATUSES: [DriverStatus, string][] = [
    ["AVAILABLE", "Disponível"],
    ["BUSY", "Ocupado"],
    ["OFFLINE", "Offline"],
];

const DATE = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric" });

function shortDate(date: Date): string {
    const part = (type: Intl.DateTimeFormatPartTypes) =>
        DATE.formatToParts(date).find((p) => p.type === type)?.value ?? "";
    return `${part("day")} ${part("month").replace(".", "")} ${part("year")}`;
}
const TIME = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

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

function scenePadding(): Padding {
    const width = typeof window === "undefined" ? 1440 : window.innerWidth;
    if (width < 768) return { top: 120, bottom: 80, left: 40, right: 40 };
    if (width < 1280) return { top: 220, bottom: 160, left: 120, right: 400 };
    return { top: 170, bottom: 170, left: 150, right: 400 };
}

function DriverDot({ driver, size }: { driver: Driver; size?: "lg" }) {
    return (
        <span
            className={`live-dot${size ? ` live-dot-${size}` : ""}`}
            data-status={driver.status}
            aria-hidden="true"
        >
            {initials(driver.name)}
        </span>
    );
}

function StopSteps({ stops }: { stops: RouteStop[] }) {
    const visits = stops.filter((s) => s.type !== "START");
    const next = visits.findIndex((s) => s.visitedAt == null);
    return (
        <div className="live-steps" aria-hidden="true">
            {visits.map((s, i) => (
                <i
                    key={s.seq}
                    className={s.visitedAt != null ? "is-done" : i === next ? "is-now" : undefined}
                />
            ))}
        </div>
    );
}

function ActiveOrder({ order, route }: { order: OrderSummary; route: OrderRoute | null }) {
    const visits = (route?.stops ?? []).filter((s) => s.type !== "START");
    const done = visits.filter((s) => s.visitedAt != null).length;
    const next = visits.find((s) => s.visitedAt == null);
    return (
        <div className="live-order">
            <div className="live-order-row">
                <Link className="live-order-code data" to={`/orders/${order.publicId}`}>
                    {order.trackingNumber}
                    <ArrowUpRight size={14} aria-hidden="true" />
                </Link>
                <StatusBadge kind="order" value={order.status} />
            </div>
            {visits.length > 0 && <StopSteps stops={route?.stops ?? []} />}
            <div className="live-order-row">
                <div className="live-kv">
                    <span>Paradas</span>
                    <b>{visits.length > 0 ? `${done} de ${visits.length}` : "—"}</b>
                </div>
                <div className="live-kv">
                    <span>Total</span>
                    <b className="data">{formatKm(route?.totalKm)}</b>
                </div>
                <div className="live-kv live-kv-end">
                    <span>ETA</span>
                    <b className="live-eta">{formatMinutes(route?.etaMinutes)}</b>
                </div>
            </div>
            {next && (
                <div className="live-next">
                    <span className="live-next-dot" data-type={next.type} aria-hidden="true" />
                    <div>
                        <div className="live-next-label">
                            Próxima parada{next.legKm != null ? ` · ${formatKm(next.legKm)}` : ""}
                        </div>
                        {next.name}
                    </div>
                </div>
            )}
        </div>
    );
}

function DriverCard({
    driver,
    stale,
    now,
    order,
    route,
    loadingOrder,
    onClose,
}: {
    driver: Driver;
    stale: boolean;
    now: number;
    order: OrderSummary | null;
    route: OrderRoute | null;
    loadingOrder: boolean;
    onClose: () => void;
}) {
    const vehicle = driver.vehicle;
    const render = vehicle ? vehicleRender(vehicle.type, "34") : null;
    return (
        <Glass
            as="section"
            className={`live-panel live-card${render ? " has-shot" : ""}`}
            aria-label="Motorista escolhido"
        >
            {render && vehicle && (
                <div className="live-card-shot">
                    <img
                        key={driver.publicId}
                        className="motion-drive"
                        src={render.src}
                        width={render.width}
                        height={render.height}
                        alt={`${vehicle.type.trim()} ${vehicle.plate}`}
                    />
                </div>
            )}
            <div className="live-card-head">
                <DriverDot driver={driver} size="lg" />
                <div className="live-card-who">
                    <h2>{driver.name}</h2>
                    <div className="live-card-sub">
                        <StatusBadge kind="driver" value={driver.status} />
                        {stale && (
                            <span className="badge badge-warning">
                                <TriangleAlert size={13} aria-hidden="true" />
                                Sem sinal
                            </span>
                        )}
                    </div>
                </div>
                <button
                    type="button"
                    className="live-icon-btn"
                    aria-label="Fechar"
                    onClick={onClose}
                >
                    <X size={16} aria-hidden="true" />
                </button>
            </div>
            <dl className="live-tiles">
                <div>
                    <dt>Placa</dt>
                    <dd className={driver.vehicle ? "data" : undefined}>
                        {driver.vehicle?.plate ?? "Sem veículo"}
                    </dd>
                </div>
                <div>
                    <dt>Veículo</dt>
                    <dd>{driver.vehicle?.type ?? "—"}</dd>
                </div>
                <div>
                    <dt>Último sinal</dt>
                    <dd>
                        {driver.lat == null ? "Sem posição" : formatAgo(driver.lastSeenAt, now)}
                    </dd>
                </div>
                <div>
                    <dt>{driver.fleets.length > 1 ? "Frotas" : "Frota"}</dt>
                    <dd>{driver.fleets.map((f) => f.name).join(", ") || "—"}</dd>
                </div>
            </dl>
            {loadingOrder ? (
                <Skeleton height={120} />
            ) : order ? (
                <ActiveOrder order={order} route={route} />
            ) : (
                <p className="live-order live-order-empty">Sem pedido ativo agora.</p>
            )}
            <div className="live-cta">
                {order && (
                    <Link className="btn btn-primary" to={`/orders/${order.publicId}`}>
                        Abrir pedido
                    </Link>
                )}
                <Link className="btn btn-secondary" to={`/drivers/${driver.publicId}`}>
                    Ver motorista
                </Link>
            </div>
        </Glass>
    );
}

export default function LiveMap() {
    const client = useQueryClient();
    const session = useSession();
    const connection = useConnectionState();
    const [params, setParams] = useSearchParams();
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<Filter>("ALL");
    const [fleetId, setFleetId] = useState("");
    const [selectedId, setSelectedId] = useState<string | null>(() => params.get("driver"));
    const [padding] = useState(scenePadding);
    const [now, setNow] = useState(Date.now);

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 10000);
        return () => clearInterval(timer);
    }, []);

    const drivers = useQuery({ queryKey: ["drivers", "map"], queryFn: loadAllDrivers });
    const showsStale = session?.role !== "DISPATCHER";
    const stale = useQuery({
        queryKey: ["dashboard", "fleet-status", "map"],
        queryFn: () => request<FleetStatusRows>("GET", "/dashboard/fleet/status"),
        enabled: showsStale,
    });
    const staleIds = useMemo(
        () => new Set(stale.data?.drivers?.filter((d) => d.pingStale).map((d) => d.driverId)),
        [stale.data],
    );

    useTopic<LocationEvent>("/topic/fleet/locations", (e) => {
        const cached = client.getQueryData<Driver[]>(["drivers", "map"]);
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
    const scoped = all.filter(
        (d) =>
            (!fleetId || d.fleets.some((f) => f.publicId === fleetId)) &&
            (!q ||
                d.name.toLowerCase().includes(q) ||
                (d.vehicle?.plate.toLowerCase().includes(q) ?? false)),
    );
    const visible = scoped.filter((d) => filter === "ALL" || d.status === filter);
    const countOf = (status: DriverStatus, list: Driver[]) =>
        list.filter((d) => d.status === status).length;

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
    const order = activeOrder.data?.items[0] ?? null;
    const route = useQuery({
        queryKey: ["order", order?.publicId, "route"],
        queryFn: () =>
            request<OrderRoute>("GET", `/orders/${order!.publicId}/route`).catch((e: ApiError) => {
                if (e.code === "ROUTE_NOT_FOUND") return null;
                throw e;
            }),
        enabled: !!order,
    });
    const routeData = order ? (route.data ?? null) : null;

    const select = (id: string | null) => {
        setSelectedId(id);
        setParams(
            (prev) => {
                const next = new URLSearchParams(prev);
                if (id) next.set("driver", id);
                else next.delete("driver");
                return next;
            },
            { replace: true },
        );
    };

    const scene = liveMapScene({
        drivers: visible,
        staleIds,
        selectedId,
        route: routeData,
        padding,
    });
    useMapScene(
        drivers.isSuccess
            ? {
                  ...scene,
                  onMarkerClick: (id) => {
                      if (all.some((d) => d.publicId === id)) select(id);
                  },
              }
            : null,
    );

    const staleDrivers = all.filter((d) => staleIds.has(d.publicId));
    const today = new Date(now);
    useTitleBlock({
        meta: (
            <>
                <span>
                    <CalendarDays size={14} aria-hidden="true" />
                    {shortDate(today)}
                </span>
                <span>
                    <Clock size={14} aria-hidden="true" />
                    {TIME.format(today)}
                </span>
                {drivers.isSuccess && (
                    <span>
                        {all.length} {all.length === 1 ? "motorista" : "motoristas"}
                    </span>
                )}
                {connection !== "connected" && (
                    <span className="title-notice" role="status">
                        <WifiOff size={14} aria-hidden="true" />
                        As posições podem estar desatualizadas
                    </span>
                )}
            </>
        ),
    });

    if (drivers.isError) {
        const error = drivers.error as ApiError;
        return (
            <Glass className="live-floating">
                <ErrorState
                    message={messageFor(error.code, error.message)}
                    onRetry={() => drivers.refetch()}
                />
            </Glass>
        );
    }

    if (drivers.isSuccess && all.length === 0) {
        return (
            <Glass className="live-floating">
                <EmptyState
                    title="Nenhum motorista cadastrado"
                    description="Cadastre motoristas para acompanhá-los aqui."
                    action={
                        <Link className="btn btn-secondary" to="/drivers">
                            Ir para motoristas
                        </Link>
                    }
                />
            </Glass>
        );
    }

    const legs = scene.legs ?? [];
    const total = all.length || 1;

    return (
        <div className="live-map">
            <div className="live-command-wrap">
                <Glass className="live-command" role="toolbar" aria-label="Filtros">
                    <label className="live-search">
                        <Search size={16} aria-hidden="true" />
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Motorista ou placa"
                            aria-label="Buscar motoristas"
                        />
                    </label>
                    <div className="live-seg" role="group" aria-label="Status">
                        <button
                            type="button"
                            aria-pressed={filter === "ALL"}
                            onClick={() => setFilter("ALL")}
                        >
                            Todos <span className="data">{scoped.length}</span>
                        </button>
                        {STATUSES.map(([value, label]) => (
                            <button
                                key={value}
                                type="button"
                                aria-pressed={filter === value}
                                onClick={() => setFilter(value)}
                            >
                                <span
                                    className="live-swatch"
                                    data-status={value}
                                    aria-hidden="true"
                                />
                                <span className="live-seg-label">{label}</span>{" "}
                                <span className="data">{countOf(value, scoped)}</span>
                            </button>
                        ))}
                    </div>
                    {fleets.length > 0 && (
                        <label className="live-select">
                            <small>Frota</small>
                            <select value={fleetId} onChange={(e) => setFleetId(e.target.value)}>
                                <option value="">Todas</option>
                                {fleets.map(([id, name]) => (
                                    <option key={id} value={id}>
                                        {name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}
                </Glass>
            </div>

            <aside className="live-side" aria-label="Motoristas">
                {selected && (
                    <DriverCard
                        key={selected.publicId}
                        driver={selected}
                        stale={staleIds.has(selected.publicId)}
                        now={now}
                        order={order}
                        route={routeData}
                        loadingOrder={activeOrder.isLoading}
                        onClose={() => select(null)}
                    />
                )}
                <Glass
                    as="section"
                    className="live-panel live-list-panel"
                    aria-label="Lista de motoristas"
                >
                    <h2 className="live-panel-title">
                        Motoristas <span className="data">{visible.length}</span>
                    </h2>
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
                                        className={`live-row${d.publicId === selectedId ? " is-selected" : ""}`}
                                        aria-pressed={d.publicId === selectedId}
                                        onClick={() => select(d.publicId)}
                                    >
                                        <DriverDot driver={d} />
                                        <span className="live-who">
                                            <b>{d.name}</b>
                                            <small>
                                                <span className="data">
                                                    {d.vehicle?.plate ?? "Sem veículo"}
                                                </span>
                                                {" · "}
                                                <span>
                                                    {d.lat == null
                                                        ? "Sem posição"
                                                        : formatAgo(d.lastSeenAt, now)}
                                                </span>
                                            </small>
                                        </span>
                                        <StatusBadge kind="driver" value={d.status} />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </Glass>
            </aside>

            <div className="live-zoom">
                <Glass
                    as="button"
                    variant="clear"
                    press
                    type="button"
                    className="round"
                    aria-label="Aproximar"
                    onClick={() => sendMapCommand("zoomIn")}
                >
                    <Plus size={18} aria-hidden="true" />
                </Glass>
                <Glass
                    as="button"
                    variant="clear"
                    press
                    type="button"
                    className="round live-zoom-fit"
                    aria-label="Enquadrar todos"
                    onClick={() => sendMapCommand("fitAll")}
                >
                    <Crosshair size={20} aria-hidden="true" />
                </Glass>
                <Glass
                    as="button"
                    variant="clear"
                    press
                    type="button"
                    className="round"
                    aria-label="Afastar"
                    onClick={() => sendMapCommand("zoomOut")}
                >
                    <Minus size={18} aria-hidden="true" />
                </Glass>
            </div>

            <div className="live-bottom">
                <Glass as="section" className="live-tile" aria-label="Frota agora">
                    <h3>
                        Frota agora <em>· motoristas</em>
                    </h3>
                    <div className="live-stack" aria-hidden="true">
                        {STATUSES.map(([value]) => (
                            <i
                                key={value}
                                data-status={value}
                                style={{ flex: countOf(value, all) / total }}
                            />
                        ))}
                    </div>
                    <div className="live-stack-legend">
                        {STATUSES.map(([value, label]) => (
                            <span key={value}>
                                {label}
                                <b className="data">{countOf(value, all)}</b>
                            </span>
                        ))}
                    </div>
                </Glass>
                {showsStale && stale.isSuccess && (
                    <Glass as="section" className="live-tile" aria-label="Sem sinal">
                        <h3>
                            <TriangleAlert size={14} aria-hidden="true" className="live-warn" />
                            Sem sinal <em>· acima do limite</em>
                        </h3>
                        <div className="live-stale">
                            <span className="live-big">{staleDrivers.length}</span>
                            <span>
                                {staleDrivers.length === 0
                                    ? "Todos enviando posição"
                                    : staleDrivers
                                          .slice(0, 3)
                                          .map((d) => d.name)
                                          .join(", ") +
                                      (staleDrivers.length > 3
                                          ? ` e mais ${staleDrivers.length - 3}`
                                          : "")}
                            </span>
                        </div>
                    </Glass>
                )}
                <Glass as="section" className="live-tile" aria-label="Legenda">
                    <h3>
                        Legenda <em>· rota em foco</em>
                    </h3>
                    {legs.length > 0 ? (
                        <MapLegend legs={legs} />
                    ) : (
                        <p className="caption">Escolha um motorista em rota para ver o trajeto.</p>
                    )}
                </Glass>
            </div>
        </div>
    );
}
