import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, Loader2, MapPin, Trash2, Wand2 } from "lucide-react";
import { useState, type CSSProperties, type KeyboardEvent } from "react";
import { messageFor } from "../api/errors";
import { ApiError, request } from "../api/http";
import type { OptimizeResponse, OrderDetail, OrderSummary, Page } from "../api/types";
import AlgorithmFields, { ALGORITHM_LABEL, HELD_KARP_MAX } from "../components/AlgorithmFields";
import { EmptyState, Skeleton } from "../components/blocks";
import { formatKm, formatPercent } from "../components/format";
import { FallbackNotice, MapLegend, type MapLeg } from "../components/RouteLegs";
import Glass from "../glass/Glass";
import { useTitleBlock } from "../layout/titleBlockContext";
import type { Padding } from "../map/camera";
import { useMapScene } from "../map/useMapScene";
import HeroNumber from "../patterns/HeroNumber";
import { routeLabScene, type LabPoint } from "./routeLab/routeLabScene";

type Target = "start" | "pickup" | "waypoint" | "dropoff";

const TARGETS: [Target, string][] = [
    ["start", "Início"],
    ["pickup", "Retirada"],
    ["waypoint", "Parada"],
    ["dropoff", "Entrega"],
];

const MAX_WAYPOINTS = 50;

const coords = (p: LabPoint) => `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
const toPoint = (p: { lat: number | null; lng: number | null }): LabPoint | null =>
    p.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng } : null;
const rise = (i: number) => ({ "--i": i }) as CSSProperties;

function labPadding(): Padding {
    const width = typeof window === "undefined" ? 1440 : window.innerWidth;
    const height = typeof window === "undefined" ? 900 : window.innerHeight;
    if (width < 768)
        return { top: 200, bottom: Math.round(height * 0.7 - 210), left: 24, right: 24 };
    if (width < 1280) return { top: 270, bottom: Math.round(height * 0.48), left: 480, right: 60 };
    return { top: 150, bottom: 60, left: 500, right: 470 };
}

function TargetPicker({ target, onTarget }: { target: Target; onTarget: (t: Target) => void }) {
    const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
        const step =
            event.key === "ArrowRight" || event.key === "ArrowDown"
                ? 1
                : event.key === "ArrowLeft" || event.key === "ArrowUp"
                  ? -1
                  : 0;
        if (!step) return;
        event.preventDefault();
        const next = (index + step + TARGETS.length) % TARGETS.length;
        onTarget(TARGETS[next][0]);
        const group = event.currentTarget.parentElement;
        group?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
    };
    return (
        <div
            className="segmented lab-targets"
            role="radiogroup"
            aria-label="O que o próximo clique define"
        >
            {TARGETS.map(([value, text], index) => (
                <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={target === value}
                    tabIndex={target === value ? 0 : -1}
                    onClick={() => onTarget(value)}
                    onKeyDown={(event) => move(event, index)}
                >
                    {text}
                </button>
            ))}
        </div>
    );
}

function PointRow({
    title,
    pin,
    kind,
    point,
    onRemove,
}: {
    title: string;
    pin: string;
    kind: Target;
    point: LabPoint;
    onRemove: () => void;
}) {
    return (
        <li className="lab-point">
            <span className={`lab-pin is-${kind}`} aria-hidden="true">
                <span>{pin}</span>
            </span>
            <span className="lab-point-text">
                <span>{title}</span>
                <code>{coords(point)}</code>
            </span>
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

function Comparison({
    comparison,
    waypointCount,
}: {
    comparison: NonNullable<OptimizeResponse["comparison"]>;
    waypointCount: number;
}) {
    const entries = Object.entries(comparison);
    const best = Math.min(...entries.map(([, c]) => c.totalKm));
    const maxKm = Math.max(...entries.map(([, c]) => c.totalKm), 0);
    const maxMs = Math.max(...entries.map(([, c]) => c.ms), 0);
    const share = (value: number, max: number) => `${max > 0 ? (value / max) * 100 : 0}%`;
    return (
        <div className="lab-block">
            <span className="micro">Comparação</span>
            <ul className="lab-compare" aria-label="Comparação dos algoritmos">
                {entries.map(([name, c], i) => (
                    <li key={name} className={c.totalKm === best ? "is-best" : undefined}>
                        <div className="lab-compare-head">
                            <span>{ALGORITHM_LABEL[name] ?? name}</span>
                            {c.totalKm === best && <span className="lab-best">Menor</span>}
                            <b>{formatKm(c.totalKm)}</b>
                        </div>
                        <div className="lab-bars">
                            <span className="lab-tracks" aria-hidden="true">
                                <span className="lab-track">
                                    <i
                                        className="motion-grow"
                                        style={{ ...rise(i), width: share(c.totalKm, maxKm) }}
                                    />
                                </span>
                                <span className="lab-track is-time">
                                    <i
                                        className="motion-grow"
                                        style={{ ...rise(i + 1), width: share(c.ms, maxMs) }}
                                    />
                                </span>
                            </span>
                            <small>{c.ms} ms</small>
                        </div>
                    </li>
                ))}
            </ul>
            {waypointCount > HELD_KARP_MAX && (
                <p className="lab-note">
                    O método exato fica de fora acima de {HELD_KARP_MAX} paradas.
                </p>
            )}
        </div>
    );
}

function ResultPanel({
    result,
    legs,
    waypointCount,
}: {
    result: OptimizeResponse;
    legs: MapLeg[];
    waypointCount: number;
}) {
    return (
        <Glass as="section" className="lab-result motion-rise" aria-label="Resultado">
            <div className="lab-scroll">
                <div className="lab-result-main">
                    <span className="micro">
                        Resultado · {ALGORITHM_LABEL[result.algorithm] ?? result.algorithm}
                    </span>
                    <HeroNumber
                        label="Distância otimizada"
                        value={result.totalKm}
                        decimals={1}
                        unit="km"
                        caption={`contra ${formatKm(result.baselineKm)} na ordem original`}
                    />
                    <div className="lab-stats">
                        <div className="lab-stat">
                            <span className="micro">Economia</span>
                            <b className={result.savingsPct > 0 ? "is-good" : undefined}>
                                {formatPercent(result.savingsPct)}
                            </b>
                        </div>
                        <HeroNumber
                            size="stat"
                            label="Chegada em"
                            value={result.etaMinutes}
                            unit="min"
                        />
                    </div>
                </div>
                <div className="lab-result-side">
                    {result.comparison && Object.keys(result.comparison).length > 0 && (
                        <Comparison comparison={result.comparison} waypointCount={waypointCount} />
                    )}
                    {result.fallbackLegs > 0 && <FallbackNotice count={result.fallbackLegs} />}
                    <MapLegend legs={legs} />
                    <p className="lab-note">Simulação: nada foi salvo nem despachado.</p>
                </div>
            </div>
        </Glass>
    );
}

export default function RouteLab() {
    const [start, setStart] = useState<LabPoint | null>(null);
    const [pickup, setPickup] = useState<LabPoint | null>(null);
    const [dropoff, setDropoff] = useState<LabPoint | null>(null);
    const [waypoints, setWaypoints] = useState<LabPoint[]>([]);
    const [target, setTarget] = useState<Target>("pickup");
    const [algorithm, setAlgorithm] = useState("");
    const [seed, setSeed] = useState("");
    const [compare, setCompare] = useState(true);
    const [result, setResult] = useState<OptimizeResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [importId, setImportId] = useState("");
    const [showOriginal, setShowOriginal] = useState(true);
    const [frame, setFrame] = useState<LabPoint[]>([]);
    const [padding] = useState(labPadding);

    const orders = useQuery({
        queryKey: ["orders", "lab"],
        queryFn: () => request<Page<OrderSummary>>("GET", "/orders", undefined, { limit: 100 }),
    });

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
        } else if (waypoints.length < MAX_WAYPOINTS) edit(setWaypoints)([...waypoints, point]);
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
            const next = {
                pickup: toPoint(o.pickup),
                waypoints: o.waypoints.map(toPoint).filter((p): p is LabPoint => p !== null),
                dropoff: toPoint(o.dropoff),
            };
            setStart(null);
            setPickup(next.pickup);
            setDropoff(next.dropoff);
            setWaypoints(next.waypoints);
            setFrame(
                [next.pickup, ...next.waypoints, next.dropoff].filter(
                    (p): p is LabPoint => p !== null,
                ),
            );
            setResult(null);
            setError(null);
            setTarget("waypoint");
        },
        onError: (e: ApiError) => setError(messageFor(e.code, e.message)),
    });

    const targetLabel = TARGETS.find(([t]) => t === target)?.[1];
    const scene = routeLabScene({
        start,
        pickup,
        waypoints,
        dropoff,
        result,
        showOriginal,
        pick: { hint: `Clique no mapa para definir: ${targetLabel}`, onPick: place },
        padding,
        frame,
    });
    useMapScene(scene);

    useTitleBlock({
        title: "Simulador de rota",
        meta: (
            <span>
                Teste os algoritmos com pontos de teste. Nada é salvo e nenhum pedido é alterado.
            </span>
        ),
    });

    const ready = pickup !== null && dropoff !== null;
    const empty = !start && !pickup && !dropoff && waypoints.length === 0;

    return (
        <div className="route-lab">
            <div className="lab-command-wrap">
                <Glass className="lab-command" role="toolbar" aria-label="Otimização">
                    <AlgorithmFields
                        algorithm={algorithm}
                        onAlgorithm={setAlgorithm}
                        seed={seed}
                        onSeed={setSeed}
                        waypointCount={waypoints.length}
                        compact
                    />
                    <label className="lab-compare-toggle">
                        <input
                            type="checkbox"
                            className="check"
                            checked={compare}
                            onChange={(e) => setCompare(e.target.checked)}
                        />
                        Comparar todos os algoritmos
                    </label>
                    <button
                        type="button"
                        className="btn btn-primary"
                        disabled={!ready || optimize.isPending}
                        title={ready ? undefined : "Defina ao menos retirada e entrega."}
                        onClick={() => optimize.mutate()}
                    >
                        {optimize.isPending ? (
                            <Loader2 size={16} className="spin" aria-hidden="true" />
                        ) : (
                            <Wand2 size={16} aria-hidden="true" />
                        )}
                        Otimizar
                    </button>
                </Glass>
            </div>

            <Glass as="section" className="lab-points" aria-label="Pontos" style={rise(0)}>
                <div className="lab-block">
                    <span className="micro">Próximo clique</span>
                    <TargetPicker target={target} onTarget={setTarget} />
                </div>

                {error && (
                    <p className="notice notice-danger" role="alert">
                        {error}
                    </p>
                )}

                {!empty && (
                    <ol className="lab-list" aria-label="Pontos marcados">
                        {start && (
                            <PointRow
                                title="Início"
                                pin="·"
                                kind="start"
                                point={start}
                                onRemove={() => edit(setStart)(null)}
                            />
                        )}
                        {pickup && (
                            <PointRow
                                title="Retirada"
                                pin="R"
                                kind="pickup"
                                point={pickup}
                                onRemove={() => edit(setPickup)(null)}
                            />
                        )}
                        {waypoints.map((w, i) => (
                            <PointRow
                                key={`${i}-${w.lat}-${w.lng}`}
                                title={`Parada ${i + 1}`}
                                pin={String(i + 1)}
                                kind="waypoint"
                                point={w}
                                onRemove={() =>
                                    edit(setWaypoints)(waypoints.filter((_, j) => j !== i))
                                }
                            />
                        ))}
                        {dropoff && (
                            <PointRow
                                title="Entrega"
                                pin="E"
                                kind="dropoff"
                                point={dropoff}
                                onRemove={() => edit(setDropoff)(null)}
                            />
                        )}
                    </ol>
                )}

                <div className="lab-meta">
                    <span>
                        <b>{waypoints.length}</b> de {MAX_WAYPOINTS} paradas
                    </span>
                    {waypoints.length > HELD_KARP_MAX && (
                        <span>O método exato vai até {HELD_KARP_MAX} paradas</span>
                    )}
                    {!ready && <span>Defina ao menos retirada e entrega.</span>}
                </div>

                <div className="lab-import">
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
                        {importOrder.isPending ? (
                            <Loader2 size={16} className="spin" aria-hidden="true" />
                        ) : (
                            <Download size={16} aria-hidden="true" />
                        )}
                        Importar
                    </button>
                </div>

                <button
                    type="button"
                    role="switch"
                    aria-checked={showOriginal}
                    className="lab-switch"
                    onClick={() => setShowOriginal((v) => !v)}
                >
                    <span className="lab-switch-track" aria-hidden="true">
                        <i />
                    </span>
                    <span className="legend-swatch legend-original" aria-hidden="true" />
                    Ordem original (linha reta)
                </button>
            </Glass>

            {result ? (
                <ResultPanel
                    result={result}
                    legs={scene.legs ?? []}
                    waypointCount={waypoints.length}
                />
            ) : optimize.isPending ? (
                <Glass as="section" className="lab-result motion-rise" aria-label="Resultado">
                    <span className="micro">Otimizando</span>
                    <Skeleton height={120} width={260} />
                    <Skeleton height={44} />
                    <Skeleton height={88} />
                </Glass>
            ) : empty ? (
                <Glass className="lab-result lab-empty" style={rise(1)}>
                    <EmptyState
                        icon={MapPin}
                        title="Clique no mapa para marcar a retirada"
                        description="Depois marque a entrega e as paradas, ou importe os pontos de um pedido."
                    />
                </Glass>
            ) : null}
        </div>
    );
}
