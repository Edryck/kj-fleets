import { Client, type StompSubscription } from "@stomp/stompjs";
import { clearSession } from "../auth/session";

export type ConnectionState = "connected" | "reconnecting" | "offline";
type Handler = (payload: unknown) => void;

interface Entry {
    handlers: Set<Handler>;
    sub: StompSubscription | null;
}

// depois dessas quedas seguidas o indicador vira "Offline" (a tentativa continua)
const OFFLINE_AFTER = 4;

let client: Client | null = null;
let state: ConnectionState = "offline";
let attempts = 0;
let everConnected = false;
let stableTimer: ReturnType<typeof setTimeout> | undefined;
const topics = new Map<string, Entry>();
const stateListeners = new Set<() => void>();
const reconnectListeners = new Set<() => void>();

function setState(next: ConnectionState) {
    if (state === next) return;
    state = next;
    stateListeners.forEach((listener) => listener());
}

function attach(topic: string, entry: Entry) {
    if (!client || state !== "connected" || entry.sub) return;
    entry.sub = client.subscribe(topic, (frame) => {
        let payload: unknown;
        try {
            payload = JSON.parse(frame.body);
        } catch {
            return;
        }
        entry.handlers.forEach((handler) => handler(payload));
    });
}

function dropSubs() {
    topics.forEach((entry) => (entry.sub = null));
}

export function connect(token: string): void {
    disconnect();
    const wsUrl =
        import.meta.env.VITE_WS_URL ??
        `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;
    let opened = false;
    const instance: Client = new Client({
        brokerURL: wsUrl,
        connectHeaders: { Authorization: `Bearer ${token}` },
        reconnectDelay: 1000,
        heartbeatIncoming: 10000,
        heartbeatOutgoing: 10000,
        // backoff: 1 s, 2 s, 4 s... até 15 s
        beforeConnect: () => {
            instance.reconnectDelay = Math.min(1000 * 2 ** attempts, 15000);
        },
        onConnect: () => {
            if (client !== instance) return;
            opened = true;
            // só zera o backoff se a conexão aguentar: SUBSCRIBE recusado derruba o socket e viraria loop de 1 s
            clearTimeout(stableTimer);
            stableTimer = setTimeout(() => {
                if (client === instance) attempts = 0;
            }, 10000);
            setState("connected");
            topics.forEach((entry, topic) => attach(topic, entry));
            if (everConnected) reconnectListeners.forEach((listener) => listener());
            everConnected = true;
        },
        onWebSocketClose: (event) => {
            if (client !== instance) return;
            dropSubs();
            // o servidor fecha com 1008 quando o JWT vence; reconectar só repetiria a recusa
            if (event.code === 1008) {
                disconnect();
                clearSession("expired");
                return;
            }
            attempts++;
            setState(attempts >= OFFLINE_AFTER ? "offline" : "reconnecting");
        },
        // só o CONNECT recusado encerra a sessão; um SUBSCRIBE recusado depois de conectar
        // (a API manda ERROR e fecha o socket) deixa o onWebSocketClose reconectar com backoff
        onStompError: () => {
            if (client !== instance || opened) return;
            disconnect();
            clearSession("expired");
        },
    });
    client = instance;
    setState("reconnecting");
    instance.activate();
}

export function disconnect(): void {
    const old = client;
    client = null;
    clearTimeout(stableTimer);
    attempts = 0;
    everConnected = false;
    dropSubs();
    setState("offline");
    if (old) void old.deactivate();
}

// várias telas no mesmo tópico compartilham uma assinatura STOMP só
export function subscribeTopic<T>(topic: string, handler: (payload: T) => void): () => void {
    const wrapped = handler as Handler;
    let entry = topics.get(topic);
    if (!entry) {
        entry = { handlers: new Set(), sub: null };
        topics.set(topic, entry);
    }
    entry.handlers.add(wrapped);
    attach(topic, entry);
    const mine = entry;
    return () => {
        mine.handlers.delete(wrapped);
        if (mine.handlers.size > 0) return;
        topics.delete(topic);
        try {
            mine.sub?.unsubscribe();
        } catch {
            // conexão já caiu; a assinatura morreu junto
        }
    };
}

export function onReconnect(listener: () => void): () => void {
    reconnectListeners.add(listener);
    return () => reconnectListeners.delete(listener);
}

export function getConnectionState(): ConnectionState {
    return state;
}

export function subscribeConnectionState(listener: () => void): () => void {
    stateListeners.add(listener);
    return () => stateListeners.delete(listener);
}
