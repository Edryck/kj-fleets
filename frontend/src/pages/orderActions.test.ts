import { describe, expect, it } from "vitest";
import { canCancel, nextAction } from "./orderActions";

const base = {
    status: "CREATED" as const,
    driver: { publicId: "d", name: "D" },
    vehicle: { publicId: "v", plate: "AAA1A11" },
    podRequired: false,
    podValue: null,
};

describe("nextAction", () => {
    it("CREATED com motorista e veículo despacha", () => {
        expect(nextAction(base)).toEqual({ kind: "dispatch", label: "Despachar" });
    });

    it("CREATED sem veículo não tem próxima ação", () => {
        expect(nextAction({ ...base, vehicle: null })).toBeNull();
    });

    it("avança pelas etapas do fluxo", () => {
        expect(nextAction({ ...base, status: "DISPATCHED" })).toMatchObject({
            code: "DRIVER_ENROUTE",
        });
        expect(nextAction({ ...base, status: "DRIVER_ENROUTE" })).toMatchObject({
            code: "ARRIVED",
        });
        expect(nextAction({ ...base, status: "ARRIVED" })).toMatchObject({ code: "IN_PROGRESS" });
    });

    it("IN_PROGRESS com POD exigida e sem registro pede a POD antes de concluir", () => {
        const order = { ...base, status: "IN_PROGRESS" as const, podRequired: true };
        expect(nextAction(order)?.kind).toBe("pod");
        expect(nextAction({ ...order, podValue: "ok" })).toMatchObject({ code: "COMPLETED" });
    });

    it("estados finais não têm ação", () => {
        expect(nextAction({ ...base, status: "COMPLETED" })).toBeNull();
        expect(canCancel("COMPLETED")).toBe(false);
        expect(canCancel("ARRIVED")).toBe(true);
    });
});
