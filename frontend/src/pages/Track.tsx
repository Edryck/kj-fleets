import { useQuery } from "@tanstack/react-query";
import { Ban, PackageSearch, Search } from "lucide-react";
import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError, request } from "../api/http";
import type { TrackResponse } from "../api/types";
import { useSession } from "../auth/session";
import { EmptyState, ErrorState, Skeleton } from "../components/blocks";
import { formatDateTime } from "../components/format";
import { badgeEntry } from "../components/StatusBadge";
import Wordmark from "../components/Wordmark";
import Glass from "../glass/Glass";
import AmbientBackground from "../layout/AmbientBackground";
import { timelineFromEvents } from "../patterns/eventTimeline";
import HeroNumber from "../patterns/HeroNumber";
import StopTimeline from "../patterns/StopTimeline";
import { isActive, showsEta, STATUS_HELP } from "./orderActions";

export const trackInterval = (data: TrackResponse | undefined) =>
    data && isActive(data.status) ? 30_000 : false;

function TrackResult({ data }: { data: TrackResponse }) {
    const { label, tone } = badgeEntry("order", data.status);
    const live = isActive(data.status);
    const eta = showsEta(data.status) ? data.etaMinutes : null;
    return (
        <div className="track-result" aria-live="polite">
            <span className="track-code data">{data.trackingNumber}</span>
            <div className={`big-status tone-${tone}${live ? " is-live" : ""}`}>
                <span className="big-status-dot" aria-hidden="true" />
                <h1>{label}</h1>
            </div>
            <p className="track-help">{STATUS_HELP[data.status]}</p>
            {eta != null && (
                <HeroNumber
                    size="large"
                    label="Chegada estimada"
                    value={eta}
                    unit="min"
                    caption="Previsão calculada pela operação"
                />
            )}
            {(data.status === "CANCELLED" || data.status === "FAILED") && (
                <p className="notice notice-danger">
                    <Ban size={14} aria-hidden="true" /> Em caso de dúvida, fale com quem fez o
                    pedido.
                </p>
            )}
            {data.timeline.length > 0 && (
                <StopTimeline stops={timelineFromEvents(data.timeline)} label="Eventos" />
            )}
            <p className="track-foot">
                Pedido feito em {formatDateTime(data.createdAt)}
                {data.finishedAt && <>, finalizado em {formatDateTime(data.finishedAt)}</>}
                {live && ". Esta página atualiza sozinha."}
            </p>
        </div>
    );
}

export default function Track() {
    const { trackingNumber = "" } = useParams();
    const navigate = useNavigate();
    const session = useSession();
    const [code, setCode] = useState(trackingNumber);
    const input = useRef<HTMLInputElement>(null);

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
    const checkCode = () => {
        input.current?.focus();
        input.current?.select();
    };

    return (
        <div className="track">
            <AmbientBackground visible />
            <header className="track-top">
                <Link to="/login" aria-label="KJ Fleets">
                    <Wordmark />
                </Link>
                <Link className="btn btn-secondary btn-sm" to={session ? "/dashboard" : "/login"}>
                    {session ? "Meu painel" : "Entrar"}
                </Link>
            </header>

            <main className="track-main">
                <Glass as="section" className="track-card" aria-label="Rastrear pedido">
                    {data ? (
                        <p className="track-eyebrow">Rastrear pedido</p>
                    ) : (
                        <h1 className="track-title">Rastrear pedido</h1>
                    )}
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
                            ref={input}
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
                        <p className="track-help">
                            Digite o código que você recebeu para ver onde está o pedido.
                        </p>
                    )}

                    {track.isPending && trackingNumber !== "" && <Skeleton height={240} />}

                    {error?.status === 404 && (
                        <EmptyState
                            icon={PackageSearch}
                            title="Código não encontrado"
                            description="Confira as letras e os números e tente de novo."
                            action={
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={checkCode}
                                >
                                    Conferir o código
                                </button>
                            }
                        />
                    )}
                    {track.isError && error?.status !== 404 && (
                        <ErrorState
                            message="Não foi possível consultar agora."
                            onRetry={() => track.refetch()}
                        />
                    )}

                    {data && <TrackResult data={data} />}
                </Glass>
            </main>
        </div>
    );
}
