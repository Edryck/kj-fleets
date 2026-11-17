import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { messageFor } from "../../api/errors";
import { ApiError, request } from "../../api/http";
import type { Driver, DriverStatus, Page, Vehicle } from "../../api/types";
import { toast } from "../../components/Toasts";
import { SidePanel } from "../../patterns/SidePanel";
import { invalidateDriverTotals } from "./useDriverActions";

interface FormValues {
    username: string;
    password: string;
    name: string;
    phone: string;
    licenseNumber: string;
    vehicleId: string;
    status: DriverStatus;
}

export default function DriverForm({
    driver,
    onClose,
    onSaved = onClose,
}: {
    driver: Driver | null;
    onClose: () => void;
    onSaved?: () => void;
}) {
    const client = useQueryClient();
    const vehicles = useQuery({
        queryKey: ["vehicles", "options"],
        queryFn: () => request<Page<Vehicle>>("GET", "/vehicles", undefined, { limit: 100 }),
    });
    const form = useForm<FormValues>({
        defaultValues: {
            username: driver?.username ?? "",
            password: "",
            name: driver?.name ?? "",
            phone: driver?.phone ?? "",
            licenseNumber: driver?.licenseNumber ?? "",
            vehicleId: driver?.vehicle?.publicId ?? "",
            status: driver?.status ?? "OFFLINE",
        },
    });
    const { register, handleSubmit, setError, formState } = form;
    const busy = driver?.status === "BUSY";
    const currentVehicle = driver?.vehicle?.publicId;

    const vehicleOptions = (vehicles.data?.items ?? []).filter(
        (v) =>
            v.publicId === currentVehicle ||
            (v.status !== "MAINTENANCE" &&
                (v.driverId === null || v.driverId === driver?.publicId)),
    );

    const save = useMutation({
        mutationFn: (body: object) =>
            driver
                ? request<Driver>("PUT", `/drivers/${driver.publicId}`, body)
                : request<Driver>("POST", "/drivers", body),
        onSuccess: () => {
            toast.success(driver ? "Motorista atualizado." : "Motorista cadastrado.");
            void client.invalidateQueries({ queryKey: ["drivers"] });
            void client.invalidateQueries({ queryKey: ["driver"] });
            void client.invalidateQueries({ queryKey: ["vehicles"] });
            invalidateDriverTotals(client);
            onSaved();
        },
        onError: (e: ApiError) => {
            const message = messageFor(e.code, e.message);
            if (e.code === "USERNAME_TAKEN") setError("username", { message });
            else setError("root", { message });
        },
    });

    return (
        <SidePanel
            title={driver ? "Editar motorista" : "Novo motorista"}
            onClose={onClose}
            footer={
                <>
                    <button type="button" className="btn btn-secondary" onClick={onClose}>
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        form="driver-form"
                        className="btn btn-primary"
                        disabled={save.isPending}
                    >
                        {save.isPending && (
                            <Loader2 size={16} className="spin" aria-hidden="true" />
                        )}
                        {driver ? "Salvar motorista" : "Cadastrar motorista"}
                    </button>
                </>
            }
        >
            <form
                id="driver-form"
                className="stack"
                noValidate
                onSubmit={handleSubmit((v) => {
                    const common = {
                        name: v.name.trim(),
                        phone: v.phone.trim() || null,
                        licenseNumber: v.licenseNumber.trim() || null,
                        vehicleId: v.vehicleId || null,
                    };
                    save.mutate(
                        driver
                            ? { ...common, status: busy ? undefined : v.status }
                            : { ...common, username: v.username.trim(), password: v.password },
                    );
                })}
            >
                {formState.errors.root && (
                    <p className="notice notice-danger" role="alert">
                        {formState.errors.root.message}
                    </p>
                )}
                <div className="field-row">
                    <div className="field">
                        <label htmlFor="driver-username">Usuário</label>
                        <input
                            id="driver-username"
                            className="data"
                            disabled={!!driver}
                            aria-invalid={!!formState.errors.username}
                            {...register("username", {
                                validate: (v) => !!driver || v.trim() !== "" || "Informe o usuário",
                            })}
                        />
                        {formState.errors.username ? (
                            <p className="field-error">{formState.errors.username.message}</p>
                        ) : (
                            driver && <p className="field-help">O usuário não pode ser alterado.</p>
                        )}
                    </div>
                    {!driver && (
                        <div className="field">
                            <label htmlFor="driver-password">Senha</label>
                            <input
                                id="driver-password"
                                type="password"
                                autoComplete="new-password"
                                aria-invalid={!!formState.errors.password}
                                {...register("password", {
                                    validate: (v) =>
                                        v.length >= 8 ||
                                        "A senha precisa ter pelo menos 8 caracteres",
                                })}
                            />
                            {formState.errors.password ? (
                                <p className="field-error">{formState.errors.password.message}</p>
                            ) : (
                                <p className="field-help">Mínimo de 8 caracteres.</p>
                            )}
                        </div>
                    )}
                </div>
                <div className="field">
                    <label htmlFor="driver-name">Nome</label>
                    <input
                        id="driver-name"
                        aria-invalid={!!formState.errors.name}
                        {...register("name", {
                            validate: (v) => v.trim() !== "" || "Informe o nome",
                        })}
                    />
                    {formState.errors.name && (
                        <p className="field-error">{formState.errors.name.message}</p>
                    )}
                </div>
                <div className="field-row">
                    <div className="field">
                        <label htmlFor="driver-phone">Telefone</label>
                        <input id="driver-phone" inputMode="tel" {...register("phone")} />
                    </div>
                    <div className="field">
                        <label htmlFor="driver-license">CNH</label>
                        <input
                            id="driver-license"
                            className="data"
                            {...register("licenseNumber")}
                        />
                    </div>
                </div>
                <div className="field">
                    <label htmlFor="driver-vehicle">Veículo</label>
                    <select id="driver-vehicle" {...register("vehicleId")}>
                        <option value="">Sem veículo</option>
                        {vehicleOptions.map((v) => (
                            <option key={v.publicId} value={v.publicId}>
                                {v.plate} · {v.type}
                            </option>
                        ))}
                    </select>
                </div>
                {driver && (
                    <div className="field">
                        <label htmlFor="driver-status">Status</label>
                        <select id="driver-status" disabled={busy} {...register("status")}>
                            {busy && (
                                <option value="BUSY" disabled>
                                    Ocupado
                                </option>
                            )}
                            <option value="AVAILABLE">Disponível</option>
                            <option value="OFFLINE">Offline</option>
                        </select>
                        {busy && (
                            <p className="field-help">
                                Motorista ocupado: o status volta sozinho ao concluir o pedido.
                            </p>
                        )}
                    </div>
                )}
            </form>
        </SidePanel>
    );
}
