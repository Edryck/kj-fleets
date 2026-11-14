import { beforeEach, describe, expect, it, vi } from "vitest";
import { request } from "../api/http";
import { getSession, resetSessionForTests, startSession, subscribeSession } from "./session";

const future = () => new Date(Date.now() + 3_600_000).toISOString();

beforeEach(() => {
    sessionStorage.clear();
    resetSessionForTests();
    vi.restoreAllMocks();
});

describe("session", () => {
    it("expiresAt no passado deixa deslogado", () => {
        sessionStorage.setItem("kjfleets.token", "t");
        sessionStorage.setItem("kjfleets.role", "ADMIN");
        sessionStorage.setItem("kjfleets.expiresAt", new Date(Date.now() - 1000).toISOString());
        expect(getSession()).toBeNull();
        expect(sessionStorage.getItem("kjfleets.token")).toBeNull();
    });

    it("sessão válida é restaurada do sessionStorage", () => {
        sessionStorage.setItem("kjfleets.token", "t");
        sessionStorage.setItem("kjfleets.role", "CUSTOMER");
        sessionStorage.setItem("kjfleets.expiresAt", future());
        expect(getSession()?.role).toBe("CUSTOMER");
    });

    it("401 limpa a sessão uma vez só, sem loop", async () => {
        startSession({ token: "t", role: "ADMIN", expiresAt: future() });
        const fetchMock = vi.fn(
            async () =>
                new Response(JSON.stringify({ status: 401, code: "UNAUTHORIZED", message: "x" }), {
                    status: 401,
                }),
        );
        vi.stubGlobal("fetch", fetchMock);
        const listener = vi.fn();
        subscribeSession(listener);
        await expect(request("GET", "/me")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
        expect(getSession()).toBeNull();
        await expect(request("GET", "/me")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
        expect(listener).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("401 sem sessão (login errado) não mexe em nada", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(
                async () =>
                    new Response(JSON.stringify({ code: "UNAUTHORIZED", message: "" }), {
                        status: 401,
                    }),
            ),
        );
        await expect(request("POST", "/auth/login", {})).rejects.toMatchObject({ status: 401 });
        expect(getSession()).toBeNull();
    });
});
