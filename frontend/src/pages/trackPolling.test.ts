import { describe, expect, it } from "vitest";
import type { TrackResponse } from "../api/types";
import { trackInterval } from "./Track";

const track = (status: TrackResponse["status"]): TrackResponse => ({
    trackingNumber: "KJ-1",
    status,
    createdAt: "",
    finishedAt: null,
    etaMinutes: null,
    timeline: [],
});

describe("polling do rastreio público", () => {
    it("consulta a cada 30 s enquanto o pedido está ativo", () => {
        expect(trackInterval(track("CREATED"))).toBe(30_000);
        expect(trackInterval(track("IN_PROGRESS"))).toBe(30_000);
    });

    it("para em status terminal", () => {
        for (const s of ["COMPLETED", "CANCELLED", "FAILED"] as const) {
            expect(trackInterval(track(s))).toBe(false);
        }
    });

    it("sem resposta ainda, não agenda nada", () => {
        expect(trackInterval(undefined)).toBe(false);
    });
});
