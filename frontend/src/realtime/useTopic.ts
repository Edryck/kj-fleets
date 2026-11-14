import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useSyncExternalStore } from "react";
import {
    getConnectionState,
    onReconnect,
    subscribeConnectionState,
    subscribeTopic,
    type ConnectionState,
} from "./stomp";

export interface OrderEvent {
    orderId: string;
    code: string;
    status: string;
    driverId: string | null;
    at: string;
}

export interface LocationEvent {
    driverId: string;
    name: string;
    status: "AVAILABLE" | "BUSY" | "OFFLINE";
    lat: number | null;
    lng: number | null;
    at: string;
}

// handler sempre o mais recente, sem reassinar o tópico a cada render
export function useTopics<T>(topics: string[], handler: (payload: T) => void) {
    const latest = useRef(handler);
    latest.current = handler;
    const key = topics.join("|");
    useEffect(() => {
        const offs = (key ? key.split("|") : []).map((topic) =>
            subscribeTopic<T>(topic, (payload) => latest.current(payload)),
        );
        return () => offs.forEach((off) => off());
    }, [key]);
}

export const useTopic = <T>(topic: string | null, handler: (payload: T) => void) =>
    useTopics(topic ? [topic] : [], handler);

export function useConnectionState(): ConnectionState {
    return useSyncExternalStore(subscribeConnectionState, getConnectionState);
}

// sem replay no socket: ao reconectar, refaz por REST o que está na tela
export function useReloadOnReconnect() {
    const client = useQueryClient();
    useEffect(() => onReconnect(() => void client.invalidateQueries()), [client]);
}

// equipe: qualquer evento de pedido invalida o detalhe na hora e listas/dashboards com debounce
export function useOrderEventsInvalidation(enabled: boolean) {
    const client = useQueryClient();
    const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
    const later = (key: string, ms: number) => {
        clearTimeout(timers.current[key]);
        timers.current[key] = setTimeout(
            () => void client.invalidateQueries({ queryKey: [key] }),
            ms,
        );
    };
    useTopic<OrderEvent>(enabled ? "/topic/orders" : null, (event) => {
        void client.invalidateQueries({ queryKey: ["order", event.orderId] });
        later("orders", 800);
        later("dashboard", 3000);
    });
    useEffect(() => {
        const pending = timers.current;
        return () => Object.values(pending).forEach(clearTimeout);
    }, []);
}
