import { RefreshCw, WifiOff } from "lucide-react";
import { useContext, useSyncExternalStore } from "react";
import { useLocation } from "react-router-dom";
import { useConnectionState } from "../realtime/useTopic";
import { titleFor } from "../routes";
import { TitleBlockContext, type TitleBlockConfig } from "./titleBlockContext";

export const CONNECTION_LABEL = {
    connected: "Conectado",
    reconnecting: "Reconectando",
    offline: "Offline",
} as const;

const EMPTY: TitleBlockConfig = {};
const noop = () => () => {};

export default function TitleBlock() {
    const { pathname } = useLocation();
    const store = useContext(TitleBlockContext);
    const config = useSyncExternalStore(
        store?.subscribe ?? noop,
        () => store?.get() ?? EMPTY,
        () => EMPTY,
    );
    const connection = useConnectionState();
    const label = CONNECTION_LABEL[connection];

    return (
        <header className="title-block">
            <div className="title-eyebrow">
                <span
                    className={`chip-live is-${connection}`}
                    role="status"
                    aria-label={`Tempo real: ${label}`}
                >
                    {connection === "connected" && (
                        <span className="chip-live-dot" aria-hidden="true" />
                    )}
                    {connection === "reconnecting" && (
                        <RefreshCw className="spin" size={13} aria-hidden="true" />
                    )}
                    {connection === "offline" && <WifiOff size={13} aria-hidden="true" />}
                    {connection === "connected" ? "Tempo real" : label}
                </span>
                {config.eyebrow}
            </div>
            <h1>{config.title ?? titleFor(pathname)}</h1>
            {config.meta && <div className="title-meta">{config.meta}</div>}
            {config.actions && <div className="title-actions">{config.actions}</div>}
        </header>
    );
}
