import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, Loader2, Trash2, Wand2 } from "lucide-react";
import { useMemo, useState } from "react";
import { messageFor } from "../api/errors";
import { ApiError, request } from "../api/http";
import type { OptimizeResponse, OrderDetail, OrderSummary, Page } from "../api/types";
import AlgorithmFields, { ALGORITHM_LABEL, HELD_KARP_MAX } from "../components/AlgorithmFields";
import { KpiCard } from "../components/blocks";
import { formatKm, formatMinutes, formatPercent } from "../components/format";
import MapView, { type MapMarker } from "../components/MapView";

interface Point {
    lat: number;
    lng: number;
}
type Target = "start" | "pickup" | "waypoint" | "dropoff";

const TARGETS: [Target, string][] = [
    ["start", "Início"],
    ["pickup", "Retirada"],
    ["waypoint", "Parada"],
    ["dropoff", "Entrega"],
];

const coords = (p: Point) => `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
const toPoint = (p: { lat: number | null; lng: number | null }): Point | null =>
    p.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng } : null;

export default function RouteLab() {
    const [start, setStart] = useState<Point | null>(null);
    const [pickup, setPickup] = useState<Point | null>(null);
    const [dropoff, setDropoff] = useState<Point | null>(null);
    const [waypoints, setWaypoints] = useState<Point[]>([]);
    const [target, setTarget] = useState<Target>("pickup");
    const [algorithm, setAlgorithm] = useState("");
    const [seed, setSeed] = useState("");
    const [compare, setCompare] = useState(true);
    const [result, setResult] = useState<OptimizeResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [importId, setImportId] = useState("");

    const orders = useQuery({
        queryKey: ["orders", "lab"],
        queryFn: () => request<Page<OrderSummary>>("GET", "/orders", undefined, { limit: 100 }),
    });

    // pontos mudaram: o resultado antigo deixaria de bater com o mapa
    const edit =
        <T,>(setter: (v: T) => void) =>
        (v: T) => {
            setter(v);
            setResult(null);
        };

    const place = (lat: number, lng: number) => {
        const point = { lat, lng };
        if (target === "start") edit(setStart)(point);
        else if (target === "pickup") {
            edit(setPickup)(point);
            if (!dropoff) setTarget("dropoff");
        } else if (target === "dropoff") {
            edit(setDropoff)(point);
            setTarget("waypoint");
        } else if (waypoints.length < 50) edit(setWaypoints)([...waypoints, point]);
    };

    const optimize = useMutation({
        mutationFn: () =>
            request<OptimizeResponse>("POST", "/routes/optimize", {
                start: start ?? undefined,
                pickup,
                waypoints,
                dropoff,
                algorithm: algorithm || undefined,
                seed: algorithm === "SIMULATED_ANNEALING" && seed ? Number(seed) : undefined,
                compare,
            }),
        onSuccess: (data) => {
            setResult(data);
            setError(null);
        },
        onError: (e: ApiError) => setError(messageFor(e.code, e.message)),
    });

    const importOrder = useMutation({
        mutationFn: () => request<OrderDetail>("GET", `/orders/${importId}`),
        onSuccess: (o) => {
            setStart(null);
            setPickup(toPoint(o.pickup));
            setDropoff(toPoint(o.dropoff));
            setWaypoints(o.waypoints.map(toPoint).filter((p): p is Point => p !== null));
            setResult(null);
            setError(null);
            setTarget("waypoint");
        },
        onError: (e: ApiError) => setError(messageFor(e.code, e.message)),
    });

    const markers = useMemo<MapMarker[]>(() => {
        if (result) {
            let n = 0;
            return result.stops.map((s) => {
                if (s.type === "WAYPOINT") n++;
                const kind =
                    s.type === "PICKUP"
                        ? "pickup"
                        : s.type === "DROPOFF"
                          ? "dropoff"
                          : s.type === "START"
                            ? "start"
                            : "waypoint";
                return {
                    id: `s${s.seq}`,
                    kind,
                    lat: s.lat,
                    lng: s.lng,
                    label:
                        kind === "pickup"
                            ? "R"
                            : kind === "dropoff"
                              ? "E"
                              : kind === "waypoint"
                                ? String(n)
                                : "",
                    title: `Parada ${s.seq}`,
                };
            });
        }
        const list: MapMarker[] = [];
        if (start) list.push({ id: "start", kind: "start", ...start, title: "Início" });
        if (pickup) list.push({ id: "pickup", kind: "pickup", label: "R", ...pickup });
        waypoints.forEach((w, i) =>
            list.push({ id: `w${i}`, kind: "waypoint", label: String(i + 1), ...w }),
        );
        if (dropoff) list.push({ id: "dropoff", kind: "dropoff", label: "E", ...dropoff });
        return list;
    }, [result, start, pickup, waypoints, dropoff]);

    const ready = pickup !== null && dropoff !== null;
    const best = result?.comparison
        ? Math.min(...Object.values(result.comparison).map((c) => c.totalKm))
        : null;

    return (
        <div className="stack">
            <header className="page-head">
                <div>
                    <h1>Simulador de rota</h1>
                    <p className="page-sub">
                        Teste os algoritmos com pontos de teste. Nada é salvo e nenhum pedido é
                        alterado.
                    </p>
                </div>
            </header>

            <div className="lab-grid">
                <section className="card map-card lab-map">
                    <MapView
                        markers={markers}
                        line={!!result}
                        onPick={result ? undefined : place}
                        pickHint={
                            result
                                ? undefined
                                : `Clique no mapa para definir: ${TARGETS.find(([t]) => t === target)?.[1]}`
                        }
                    />
                </section>

                <div className="stack">
                    <section className="card">
                        <h2>Pontos</h2>
                        <div
                            className="segmented"
                            role="group"
                            aria-label="O que o próximo clique define"
                        >
                            {TARGETS.map(([value, text]) => (
                                <button
                                    key={value}
                                    type="button"
                                    aria-pressed={target === value}
                                    onClick={() => setTarget(value)}
                                >
                                    {text}
                                </button>
                            ))}
                        </div>
                        <ul className="plain-list point-list">
                            {start && (
                                <PointRow
                                    title="Início"
                                    point={start}
                                    onRemove={() => edit(setStart)(null)}
                                />
                            )}
                            {pickup && (
                                <PointRow
                                    title="Retirada"
                                    point={pickup}
                                    onRemove={() => edit(setPickup)(null)}
                                />
                            )}
                            {waypoints.map((w, i) => (
                                <PointRow
                                    key={`${i}-${w.lat}-${w.lng}`}
                                    title={`Parada ${i + 1}`}
                                    point={w}
                                    onRemove={() =>
                                        edit(setWaypoints)(waypoints.filter((_, j) => j !== i))
                                    }
                                />
                            ))}
                            {dropoff && (
                                <PointRow
                                    title="Entrega"
                                    point={dropoff}
                                    onRemove={() => edit(setDropoff)(null)}
                                />
                            )}
                        </ul>
                        {!pickup && !dropoff && waypoints.length === 0 && !start && (
                            <p className="field-help">
                                Clique no mapa ou importe os pontos de um pedido.
                            </p>
                        )}
                        <p className="field-help">{waypoints.length} de 50 paradas.</p>

                        <div className="import-row">
                            <div className="field">
                                <label htmlFor="import-order">Importar de um pedido</label>
                                <select
                                    id="import-order"
                                    value={importId}
                                    onChange={(e) => setImportId(e.target.value)}
                                >
                                    <option value="">Escolha um pedido</option>
                                    {orders.data?.items.map((o) => (
                                        <option key={o.publicId} value={o.publicId}>
                                            {o.trackingNumber} ({o.waypointCount} paradas)
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                disabled={!importId || importOrder.isPending}
                                onClick={() => importOrder.mutate()}
                            >
                                <Download size={16} aria-hidden="true" />
                                Importar
                            </button>
                        </div>
                    </section>

                    <section className="card">
                        <h2>Otimização</h2>
                        <AlgorithmFields
                            algorithm={algorithm}
                            onAlgorithm={setAlgorithm}
                            seed={seed}
                            onSeed={setSeed}
                            waypointCount={waypoints.length}
                        />
                        <label className="inline-field">
                            <input
                                type="checkbox"
                                className="check"
                                checked={compare}
                                onChange={(e) => setCompare(e.target.checked)}
                            />
                            Comparar todos os algoritmos
                        </label>
                        {error && (
                            <p className="notice notice-danger lab-error" role="alert">
                                {error}
                            </p>
                        )}
                        <div className="form-actions">
                            <button
                                type="button"
                                className="btn btn-primary"
                                disabled={!ready || optimize.isPending}
                                onClick={() => optimize.mutate()}
                            >
                                {optimize.isPending ? (
                                    <Loader2 size={16} className="spin" aria-hidden="true" />
                                ) : (
                                    <Wand2 size={16} aria-hidden="true" />
                                )}
                                Otimizar rota
                            </button>
                        </div>
                        {!ready && (
                            <p className="field-help">Defina ao menos retirada e entrega.</p>
                        )}
                    </section>
                </div>
            </div>

            {result && (
                <section className="card">
                    <div className="card-head">
                        <h2>Resultado: {ALGORITHM_LABEL[result.algorithm] ?? result.algorithm}</h2>
                        <span className="caption">Simulação: nada foi salvo nem despachado.</span>
                    </div>
                    <div className="route-kpis">
                        <KpiCard label="Distância" value={formatKm(result.totalKm)} />
                        <KpiCard label="Sem otimizar" value={formatKm(result.baselineKm)} />
                        <KpiCard label="Economia" value={formatPercent(result.savingsPct)} />
                        <KpiCard label="Chegada em" value={formatMinutes(result.etaMinutes)} />
                    </div>
                    {result.comparison && (
                        <div className="table-scroll lab-compare">
                            <table className="table table-compact">
                                <thead>
                                    <tr>
                                        <th scope="col">Algoritmo</th>
                                        <th scope="col" className="num">
                                            Distância
                                        </th>
                                        <th scope="col" className="num">
                                            Tempo de cálculo
                                        </th>
                                        <th scope="col">
                                            <span className="sr-only">Melhor</span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(result.comparison).map(([name, c]) => (
                                        <tr key={name}>
                                            <td>{ALGORITHM_LABEL[name] ?? name}</td>
                                            <td className="num">{formatKm(c.totalKm)}</td>
                                            <td className="num data">{c.ms} ms</td>
                                            <td>
                                                {c.totalKm === best && (
                                                    <span className="badge badge-success">
                                                        Menor
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {waypoints.length > HELD_KARP_MAX && (
                                <p className="field-help">
                                    Held-Karp fica de fora acima de {HELD_KARP_MAX} paradas.
                                </p>
                            )}
                        </div>
                    )}
                </section>
            )}
        </div>
    );
}

function PointRow({
    title,
    point,
    onRemove,
}: {
    title: string;
    point: Point;
    onRemove: () => void;
}) {
    return (
        <li>
            <span>{title}</span>
            <span className="data caption">{coords(point)}</span>
            <button
                type="button"
                className="btn btn-ghost btn-icon"
                onClick={onRemove}
                aria-label={`Remover ${title}`}
            >
                <Trash2 size={16} aria-hidden="true" />
            </button>
        </li>
    );
}
