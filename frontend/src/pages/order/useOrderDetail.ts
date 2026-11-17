import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { messageFor } from "../../api/errors";
import { ApiError, request } from "../../api/http";
import type { Driver, OrderStatus, TrackingEntry, TrackResponse, Vehicle } from "../../api/types";
import { useSession } from "../../auth/session";
import { toast } from "../../components/Toasts";
import { useTopic, type LocationEvent } from "../../realtime/useTopic";
import { useOrder, useOrderRoute } from "./orderQueries";

export interface LiveProgress {
    etaMinutes: number | null;
    stopsDone: number;
    stopsTotal: number;
}

export type Dialog = "assign" | "pod" | "fail" | "cancel" | null;

export interface ActVars {
    path: string;
    body?: unknown;
    done?: string;
    reopenPod?: boolean;
}

export const STOP_COMPLETABLE: OrderStatus[] = [
    "DISPATCHED",
    "DRIVER_ENROUTE",
    "ARRIVED",
    "IN_PROGRESS",
];

export function useOrderDetail(id: string) {
    const client = useQueryClient();
    const session = useSession();
    const isStaff = session?.role !== "CUSTOMER";
    const canAct = session?.role === "ADMIN" || session?.role === "DISPATCHER";
    const [live, setLive] = useState<LiveProgress | null>(null);
    const [dialog, setDialog] = useState<Dialog>(null);

    const order = useOrder(id);
    const trackingNumber = order.data?.trackingNumber;
    const track = useQuery({
        queryKey: ["track", trackingNumber],
        queryFn: () => request<TrackResponse>("GET", `/track/${trackingNumber}`),
        enabled: !isStaff && !!trackingNumber,
    });
    const tracking = useQuery({
        queryKey: ["order", id, "tracking"],
        queryFn: () => request<TrackingEntry[]>("GET", `/orders/${id}/tracking`),
    });
    const route = useOrderRoute(id, isStaff);
    const driverId = order.data?.driver?.publicId;
    const driver = useQuery({
        queryKey: ["drivers", driverId],
        queryFn: () => request<Driver>("GET", `/drivers/${driverId}`),
        enabled: isStaff && !!driverId,
    });
    const vehicleId = order.data?.vehicle?.publicId;
    const vehicle = useQuery({
        queryKey: ["vehicle", vehicleId],
        queryFn: () => request<Vehicle>("GET", `/vehicles/${vehicleId}`),
        enabled: isStaff && !!vehicleId,
    });

    useTopic<LiveProgress>(`/topic/orders/${id}`, (event) => {
        setLive(event);
        void client.invalidateQueries({ queryKey: ["order", id] });
        void client.invalidateQueries({ queryKey: ["track"] });
    });
    useTopic<LocationEvent>(isStaff && driverId ? "/topic/fleet/locations" : null, (e) => {
        if (e.driverId !== driverId) return;
        client.setQueryData<Driver>(["drivers", driverId], (d) =>
            d
                ? {
                      ...d,
                      status: e.status,
                      lastSeenAt: e.at,
                      ...(e.lat != null && e.lng != null ? { lat: e.lat, lng: e.lng } : {}),
                  }
                : d,
        );
    });

    const refresh = () => {
        void client.invalidateQueries({ queryKey: ["order", id] });
        void client.invalidateQueries({ queryKey: ["orders"] });
    };

    const act = useMutation({
        mutationFn: ({ path, body }: ActVars) =>
            request<unknown>("POST", `/orders/${id}/${path}`, body ?? {}),
        onSuccess: (_data, vars) => {
            if (vars.done) toast.success(vars.done);
            setDialog(null);
            refresh();
        },
        onError: (e: ApiError, vars) => {
            toast.error(messageFor(e.code, e.message));
            if (e.code === "ORDER_INVALID_TRANSITION") {
                setDialog(null);
                refresh();
            }
            if (e.code === "ORDER_POD_REQUIRED" && vars.reopenPod) setDialog("pod");
        },
    });

    return {
        id,
        isStaff,
        canAct,
        order,
        track,
        tracking,
        route,
        driver,
        vehicle,
        live,
        dialog,
        setDialog,
        busy: act.isPending,
        run: (vars: ActVars) => act.mutate(vars),
    };
}

export type OrderDetailState = ReturnType<typeof useOrderDetail>;

export function useCopyTrackingLink(trackingNumber: string) {
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(
                `${window.location.origin}/track/${trackingNumber}`,
            );
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.error("Não foi possível copiar o link.");
        }
    };
    return { copied, copy };
}
