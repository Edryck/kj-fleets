import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { messageFor } from "../../api/errors";
import { ApiError, request } from "../../api/http";
import type { Driver } from "../../api/types";
import { toast } from "../../components/Toasts";

export function invalidateDriverTotals(client: QueryClient) {
    void client.invalidateQueries({ queryKey: ["/drivers"] });
}

export function useDriverActions(onRemoved?: () => void) {
    const client = useQueryClient();
    const refresh = () => {
        void client.invalidateQueries({ queryKey: ["drivers"] });
        void client.invalidateQueries({ queryKey: ["driver"] });
        invalidateDriverTotals(client);
    };
    const remove = useMutation({
        mutationFn: (driver: Driver) => request<void>("DELETE", `/drivers/${driver.publicId}`),
        onSuccess: () => {
            toast.success("Motorista excluído.");
            refresh();
            onRemoved?.();
        },
        onError: (e: ApiError) => toast.error(messageFor(e.code, e.message)),
    });
    const reactivate = useMutation({
        mutationFn: (driver: Driver) =>
            request<Driver>("POST", `/drivers/${driver.publicId}/reactivate`),
        onSuccess: () => {
            toast.success("Motorista reativado.");
            refresh();
        },
        onError: (e: ApiError) => toast.error(messageFor(e.code, e.message)),
    });
    return { remove, reactivate };
}
