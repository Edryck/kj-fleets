import { useQuery } from "@tanstack/react-query";
import { Ban, Search, Timer, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError, request } from "../api/http";
import type { TrackResponse } from "../api/types";
import { useSession } from "../auth/session";
import { ErrorState, Skeleton } from "../components/blocks";
import { formatDateTime, formatMinutes } from "../components/format";
import JourneyRail from "../components/JourneyRail";
import StatusBadge from "../components/StatusBadge";
import Wordmark from "../components/Wordmark";
import { isActive, showsEta, STATUS_HELP, TIMELINE_LABEL } from "./orderActions";

// não há tópico público: enquanto o pedido anda, consulta a cada 30 s
export const trackInterval = (data: TrackResponse | undefined) =>
    data && isActive(data.status) ? 30_000 : false;

export default function Track() {
    const { trackingNumber = "" } = useParams();
    const navigate = useNavigate();
    const session = useSession();
    const [code, setCode] = useState(trackingNumber);

    const track = useQuery({
        queryKey: ["track", trackingNumber],
        queryFn: () =>
            request<TrackResponse>(
                "GET",
                `/track/${encodeURIComponent(trackingNumber)}`,
                undefined,
                undefined,
                { anonymous: true },
            ),
        enabled: trackingNumber !== "",
        refetchInterval: (query) => trackInterval(query.state.data),
    });

    const error = track.error as ApiError | null;
    const data = track.data;

    return (
        <div className="track">
            <header className="track-top">
                <Link to="/login" aria-label="KJ Fleets">
                    <Wordmark />
                </Link>
                <Link className="btn btn-secondary btn-sm" to={session ? "/dashboard" : "/login"}>
                    {session ? "Meu painel" : "Entrar"}
                </Link>
            </header>

            <main className="track-main">
                <h1>Rastrear pedido</h1>
                <form
                    className="track-form"
                    onSubmit={(e) => {
                        e.preventDefault();
                        const next = code.trim();
                        if (next) navigate(`/track/${encodeURIComponent(next)}`);
                    }}
                >
                    <label className="sr-only" htmlFor="track-code">
                        Código do pedido
                    </label>
                    <input
                        id="track-code"
                        className="data"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        placeholder="Código do pedido"
                        autoComplete="off"
                    />
                    <button type="submit" className="btn btn-primary">
                        <Search size={16} aria-hidden="true" />
                        Rastrear
                    </button>
                </form>

                {trackingNumber === "" && (
                    <p className="page-sub">
                        Digite o código que você recebeu para ver onde está o pedido.
                    </p>
                )}

                {track.isPending && trackingNumber !== "" && <Skeleton height={240} />}

                {error?.status === 404 && (
                    <p className="notice notice-warning" role="alert">
                        <TriangleAlert size={14} aria-hidden="true" /> Código não encontrado,
                        confira e tente de novo.
                    </p>
                )}
                {track.isError && error?.status !== 404 && (
                    <ErrorState
                        message="Não foi possível consultar agora."
                        onRetry={() => track.refetch()}
                    />
                )}

                {data && (
                    <section className="card track-card" aria-live="polite">
                        <div className="track-head">
                            <span className="data track-code">{data.trackingNumber}</span>
                            <StatusBadge kind="order" value={data.status} />
                        </div>
                        <p className="status-help">{STATUS_HELP[data.status]}</p>
                        <JourneyRail status={data.status} />
                        {(data.status === "CANCELLED" || data.status === "FAILED") && (
                            <p className="notice notice-danger">
                                <Ban size={14} aria-hidden="true" /> Em caso de dúvida, fale com
                                quem fez o pedido.
                            </p>
                        )}
                        {showsEta(data.status) && data.etaMinutes != null && (
                            <p className="status-fact">
                                <Timer size={18} aria-hidden="true" />
                                <span>
                                    Chega em cerca de{" "}
                                    <strong>{formatMinutes(data.etaMinutes)}</strong>
                                </span>
                            </p>
                        )}
                        <ol className="timeline">
                            {[...data.timeline].reverse().map((t, i) => (
                                <li
                                    key={`${t.at}-${i}`}
                                    className={
                                        t.status === "CANCELLED" || t.status === "FAILED"
                                            ? "tl-bad"
                                            : undefined
                                    }
                                >
                                    <div className="tl-head">
                                        <strong>{TIMELINE_LABEL[t.code] ?? t.code}</strong>
                                        <span className="caption">{formatDateTime(t.at)}</span>
                                    </div>
                                </li>
                            ))}
                        </ol>
                        <p className="caption">
                            Pedido feito em {formatDateTime(data.createdAt)}
                            {data.finishedAt && (
                                <>, finalizado em {formatDateTime(data.finishedAt)}</>
                            )}
                            {isActive(data.status) && ". Esta página atualiza sozinha."}
                        </p>
                    </section>
                )}
            </main>
        </div>
    );
}
