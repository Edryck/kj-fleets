import { beforeEach, describe, expect, it, vi } from "vitest";

interface Config {
    brokerURL: string;
    connectHeaders: Record<string, string>;
    onConnect: () => void;
    onWebSocketClose: (event: { code: number }) => void;
    onStompError: () => void;
}

const { created, unsubscribes, FakeClient } = vi.hoisted(() => {
    const created: InstanceType<typeof FakeClient>[] = [];
    const unsubscribes: ReturnType<typeof vi.fn>[] = [];

    class FakeClient {
        config: Config;
        deactivate = vi.fn();
        activate = vi.fn();
        handlers = new Map<string, (frame: { body: string }) => void>();
        subscribe = vi.fn((topic: string, handler: (frame: { body: string }) => void) => {
            this.handlers.set(topic, handler);
            const unsubscribe = vi.fn();
            unsubscribes.push(unsubscribe);
            return { unsubscribe };
        });
        constructor(config: Config) {
            this.config = config;
            created.push(this);
        }
    }

    return { created, unsubscribes, FakeClient };
});

vi.mock("@stomp/stompjs", () => ({ Client: FakeClient }));
const clearSession = vi.fn();
vi.mock("../auth/session", () => ({ clearSession: (reason: string) => clearSession(reason) }));

import { connect, disconnect, getConnectionState, onReconnect, subscribeTopic } from "./stomp";

beforeEach(() => {
    disconnect();
    created.length = 0;
    unsubscribes.length = 0;
    clearSession.mockClear();
});

describe("stomp manager", () => {
    it("sends the token on CONNECT and reports the state", () => {
        connect("tok");
        const client = created[0];
        expect(client.config.connectHeaders).toEqual({ Authorization: "Bearer tok" });
        expect(client.activate).toHaveBeenCalled();
        expect(getConnectionState()).toBe("reconnecting");
        client.config.onConnect();
        expect(getConnectionState()).toBe("connected");
    });

    it("shares one STOMP subscription per topic and drops it with the last handler", () => {
        connect("tok");
        const client = created[0];
        client.config.onConnect();
        const a = vi.fn();
        const b = vi.fn();
        const offA = subscribeTopic("/topic/orders", a);
        const offB = subscribeTopic("/topic/orders", b);
        expect(client.subscribe).toHaveBeenCalledTimes(1);

        client.handlers.get("/topic/orders")?.({ body: '{"orderId":"o1"}' });
        expect(a).toHaveBeenCalledWith({ orderId: "o1" });
        expect(b).toHaveBeenCalledWith({ orderId: "o1" });

        offA();
        expect(unsubscribes[0]).not.toHaveBeenCalled();
        offB();
        expect(unsubscribes[0]).toHaveBeenCalledTimes(1);
    });

    it("subscribes when the socket connects after the screen asked", () => {
        const handler = vi.fn();
        const off = subscribeTopic("/topic/fleet/locations", handler);
        connect("tok");
        const client = created[0];
        expect(client.subscribe).not.toHaveBeenCalled();
        client.config.onConnect();
        expect(client.subscribe).toHaveBeenCalledTimes(1);
        off();
    });

    it("fires onReconnect once and restores subscriptions without duplicates", () => {
        connect("tok");
        const client = created[0];
        client.config.onConnect();
        const reloaded = vi.fn();
        const handler = vi.fn();
        const offReload = onReconnect(reloaded);
        const off = subscribeTopic("/topic/orders", handler);
        expect(reloaded).not.toHaveBeenCalled();

        client.config.onWebSocketClose({ code: 1006 });
        expect(getConnectionState()).toBe("reconnecting");
        client.config.onConnect();

        expect(reloaded).toHaveBeenCalledTimes(1);
        expect(client.subscribe).toHaveBeenCalledTimes(2);
        client.handlers.get("/topic/orders")?.({ body: "{}" });
        expect(handler).toHaveBeenCalledTimes(1);
        off();
        offReload();
    });

    it("logs out and stops reconnecting on close code 1008", () => {
        connect("tok");
        const client = created[0];
        client.config.onConnect();
        client.config.onWebSocketClose({ code: 1008 });
        expect(clearSession).toHaveBeenCalledWith("expired");
        expect(client.deactivate).toHaveBeenCalled();
        expect(getConnectionState()).toBe("offline");
    });

    it("goes offline after several failed attempts", () => {
        connect("tok");
        const client = created[0];
        for (let i = 0; i < 4; i++) client.config.onWebSocketClose({ code: 1006 });
        expect(getConnectionState()).toBe("offline");
    });
});
