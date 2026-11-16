import type { DriverRow, Meta, OrdersSummary } from "../../api/types";

export const meta: Meta = {
    generatedAt: "2026-11-16T13:00:00Z",
    timezone: "America/Sao_Paulo",
    period: "today",
    from: null,
    to: null,
};

export const driverRow = (id: string, extra: Partial<DriverRow> = {}): DriverRow => ({
    driverId: id,
    name: "Rafael Lima",
    status: "BUSY",
    vehiclePlate: "RHN7C02",
    vehicleStatus: "IN_USE",
    activeOrderId: null,
    queueSize: 0,
    lastSeenAt: "2026-11-16T12:59:00Z",
    pingStale: false,
    lat: -24.56,
    lng: -54.06,
    ...extra,
});

export const summary = (extra: Partial<OrdersSummary> = {}): OrdersSummary => ({
    meta,
    created: 128,
    completed: 112,
    failed: 4,
    cancelled: 6,
    cancelledByCustomer: 4,
    cancelledByStaff: 2,
    cancelledByUnknown: 0,
    successRate: { rate: 0.93, n: 120 },
    failureRate: { rate: 0.03, n: 120 },
    cancelRate: { rate: 0.05, n: 120 },
    topFailureReasons: [{ reason: "Destinatário ausente", count: 2 }],
    avgWaitMinutes: 18,
    avgCycleMinutes: 46,
    podRate: { rate: 0.91, n: 98 },
    previous: null,
    ...extra,
});
