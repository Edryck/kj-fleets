import { useQuery } from "@tanstack/react-query";
import { Loader2, RotateCcw } from "lucide-react";
import { useMemo, useState, type CSSProperties } from "react";
import { messageFor } from "../api/errors";
import { ApiError, request } from "../api/http";
import type { GraphRoute, GraphStatus } from "../api/types";
import { ErrorState, Skeleton } from "../components/blocks";
import { formatDateTime, formatKm } from "../components/format";
import type { MapMarker } from "../components/MapView";
import type { MapLeg } from "../components/RouteLegs";
import Glass from "../glass/Glass";
import { useTitleBlock } from "../layout/titleBlockContext";
import { GlassMapFrame } from "../patterns/GlassMapFrame";

interface Point {
    lat: number;
    lng: number;
}

const count = new Intl.NumberFormat("pt-BR");
const coords = (p: Point) => `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;

export default function RoadGraph() {
    const [from, setFrom] = useState<Point | null>(null);
    const [to, setTo] = useState<Point | null>(null);

    const status = useQuery({
        queryKey: ["graph", "status"],
        queryFn: () => request<GraphStatus>("GET", "/graph/status"),
        refetchInterval: (q) => (q.state.data?.reason === "importando" ? 4000 : false),
    });
    const loaded = status.data?.loaded === true;

    const test = useQuery({
        queryKey: ["graph", "route", from, to],
        queryFn: () =>
            request<GraphRoute>("GET", "/graph/route", undefined, {
                fromLat: from!.lat,
                fromLng: from!.lng,
                toLat: to!.lat,
                toLng: to!.lng,
            }),
        enabled: loaded && from !== null && to !== null,
        retry: false,
    });

    const pick = (lat: number, lng: number) => {
        if (from && !to) setTo({ lat, lng });
        else {
            setFrom({ lat, lng });
            setTo(null);
        }
    };

    const markers = useMemo<MapMarker[]>(() => {
        const list: MapMarker[] = [];
        if (from) list.push({ id: "from", kind: "waypoint", label: "A", ...from, title: "Origem" });
        if (to) list.push({ id: "to", kind: "waypoint", label: "B", ...to, title: "Destino" });
        return list;
    }, [from, to]);

    const legs = useMemo<MapLeg[] | undefined>(
        () =>
            test.data
                ? [
                      {
                          kind: test.data.distanceSource === "ROAD" ? "road" : "estimated",
                          points: test.data.path,
                      },
                  ]
                : undefined,
        [test.data],
    );

    const s = status.data;
    const importing = s?.reason === "importando";

    useTitleBlock({
        title: "Mapa viário",
        meta: "Grafo de ruas do Sul do país e teste de caminho entre dois pontos",
    });
    const hint = !from
        ? "Clique no mapa para marcar a origem (A)"
        : !to
          ? "Clique no mapa para marcar o destino (B)"
          : "Clique de novo para começar outro teste";

    const tone = !s
        ? "neutral"
        : s.loaded
          ? "success"
          : importing
            ? "warning"
            : s.mode === "ROAD"
              ? "danger"
              : "offline";
    const label = !s
        ? ""
        : s.loaded
          ? "Carregado"
          : importing
            ? "Importando"
            : s.mode === "ROAD"
              ? "Com erro"
              : "Desligado";

    return (
        <div className="graph-lab">
            <GlassMapFrame
                className="graph-map"
                markers={markers}
                legs={legs}
                fit={false}
                onPick={loaded ? pick : undefined}
                pickHint={loaded ? hint : undefined}
            />

            <div className="graph-side">
                <Glass
                    as="section"
                    className="insight-card graph-status"
                    aria-busy={status.isLoading}
                    aria-labelledby="graph-title"
                >
                    <h2 id="graph-title" className="insight-eyebrow">
                        Grafo de ruas
                    </h2>
                    {status.isLoading && <Skeleton height={120} />}
                    {status.isError && (
                        <ErrorState
                            message={messageFor(
                                (status.error as ApiError).code,
                                status.error.message,
                            )}
                            onRetry={() => void status.refetch()}
                        />
                    )}
                    {s && (
                        <div className={`big-status tone-${tone}${importing ? " is-live" : ""}`}>
                            <span className="big-status-dot" aria-hidden="true" />
                            <b>{label}</b>
                        </div>
                    )}
                    {s && !s.loaded && (
                        <p
                            className={`notice ${
                                importing || s.mode !== "ROAD" ? "notice-info" : "notice-danger"
                            }`}
                            role="status"
                        >
                            {s.mode !== "ROAD"
                                ? "Modo linha reta: as rotas não usam as ruas. Para ligar, suba a API com ROUTING_MODE=road."
                                : importing
                                  ? "Importando o mapa. Isso leva alguns minutos na primeira vez; as rotas usam linha reta até terminar."
                                  : `Não foi possível carregar o mapa: ${s.reason ?? "motivo desconhecido"}.`}
                        </p>
                    )}
                    {s?.loaded && (
                        <>
                            <div className="graph-figures">
                                <div className="graph-figure">
                                    <b className="data">{count.format(s.nodes)}</b>
                                    <span>Cruzamentos</span>
                                </div>
                                <div className="graph-figure">
                                    <b className="data">{count.format(s.edges)}</b>
                                    <span>Trechos de rua</span>
                                </div>
                            </div>
                            <dl className="graph-rows">
                                <div>
                                    <dt>Região</dt>
                                    <dd>{s.region}</dd>
                                </div>
                                <div>
                                    <dt>Importado em</dt>
                                    <dd>{formatDateTime(s.importedAt)}</dd>
                                </div>
                                <div>
                                    <dt>Carga</dt>
                                    <dd className="data">{count.format(s.loadMillis)} ms</dd>
                                </div>
                            </dl>
                        </>
                    )}
                </Glass>

                {loaded && (
                    <Glass
                        as="section"
                        className="insight-card graph-test"
                        aria-labelledby="graph-test-title"
                        style={{ "--i": 1 } as CSSProperties}
                    >
                        <div className="insight-card-head">
                            <h2 id="graph-test-title">Teste entre dois pontos</h2>
                            {(from || to) && (
                                <button
                                    type="button"
                                    className="btn btn-ghost"
                                    onClick={() => {
                                        setFrom(null);
                                        setTo(null);
                                    }}
                                >
                                    <RotateCcw size={16} aria-hidden="true" />
                                    Limpar
                                </button>
                            )}
                        </div>
                        <p className="field-help">
                            O clique no mapa define a latitude e a longitude. Nada é salvo.
                        </p>
                        <dl className="graph-rows">
                            <div>
                                <dt>Origem (A)</dt>
                                <dd className="data">{from ? coords(from) : "Clique no mapa"}</dd>
                            </div>
                            <div>
                                <dt>Destino (B)</dt>
                                <dd className="data">{to ? coords(to) : "Clique no mapa"}</dd>
                            </div>
                            {test.data && !test.isFetching && (
                                <>
                                    <div>
                                        <dt>Distância</dt>
                                        <dd className="data">{formatKm(test.data.km)}</dd>
                                    </div>
                                    <div>
                                        <dt>Cálculo</dt>
                                        <dd className="data">{test.data.ms} ms</dd>
                                    </div>
                                </>
                            )}
                        </dl>
                        {test.isFetching && (
                            <p className="field-help">
                                <Loader2 size={14} className="spin" aria-hidden="true" /> Calculando
                            </p>
                        )}
                        {test.isError && (
                            <p className="notice notice-danger" role="alert">
                                {(test.error as ApiError).code === "GRAPH_NOT_LOADED"
                                    ? "O mapa viário não está carregado. Aguarde a importação ou confira o estado acima."
                                    : messageFor((test.error as ApiError).code, test.error.message)}
                            </p>
                        )}
                        {test.data?.distanceSource === "HAVERSINE" && !test.isFetching && (
                            <p className="notice notice-warning" role="status">
                                Sem caminho pelas ruas entre os dois pontos. A distância é uma
                                estimativa em linha reta.
                            </p>
                        )}
                    </Glass>
                )}
            </div>
        </div>
    );
}
