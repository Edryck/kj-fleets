import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { request } from "../../api/http";
import type { Driver, OrderDetail as Order, Page, Vehicle } from "../../api/types";
import { formatKm } from "../../components/format";
import { ConfirmDialog, Modal } from "../../components/overlays";
import type { OrderDetailState } from "./useOrderDetail";

interface Nearest {
    driver: Driver;
    distanceKm: number;
}

function AssignModal({
    order,
    busy,
    onSubmit,
    onClose,
}: {
    order: Order;
    busy: boolean;
    onSubmit: (driverId: string, vehicleId?: string) => void;
    onClose: () => void;
}) {
    const [driverId, setDriverId] = useState(order.driver?.publicId ?? "");
    const [vehicleId, setVehicleId] = useState("");
    const { lat, lng } = order.pickup;
    const drivers = useQuery({
        queryKey: ["drivers", "all"],
        queryFn: () => request<Page<Driver>>("GET", "/drivers", undefined, { limit: 100 }),
    });
    const vehicles = useQuery({
        queryKey: ["vehicles", "all"],
        queryFn: () => request<Page<Vehicle>>("GET", "/vehicles", undefined, { limit: 100 }),
    });
    const nearest = useQuery({
        queryKey: ["drivers", "nearest", lat, lng],
        queryFn: () =>
            request<Nearest[]>("GET", "/drivers/nearest", undefined, {
                lat: lat!,
                lng: lng!,
                limit: 5,
            }),
        enabled: lat != null && lng != null,
    });
    const available = drivers.data?.items.filter((d) => d.status === "AVAILABLE") ?? [];
    const freeVehicles = vehicles.data?.items.filter((v) => v.status === "AVAILABLE") ?? [];

    return (
        <Modal
            title={order.driver ? "Trocar motorista" : "Atribuir motorista"}
            onClose={onClose}
            footer={
                <>
                    <button type="button" className="btn btn-secondary" onClick={onClose}>
                        Voltar
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary"
                        disabled={!driverId || busy}
                        onClick={() => onSubmit(driverId, vehicleId || undefined)}
                    >
                        {busy && <Loader2 size={16} className="spin" aria-hidden="true" />}
                        Atribuir
                    </button>
                </>
            }
        >
            {nearest.data && nearest.data.length > 0 && (
                <div className="field">
                    <span className="caption">Mais próximos da retirada</span>
                    <ul className="nearest">
                        {nearest.data.map(({ driver, distanceKm }) => (
                            <li key={driver.publicId}>
                                <button
                                    type="button"
                                    aria-pressed={driverId === driver.publicId}
                                    onClick={() => setDriverId(driver.publicId)}
                                >
                                    <span>{driver.name}</span>
                                    <span className="data">{formatKm(distanceKm)}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            <div className="field">
                <label htmlFor="assign-driver">Motorista</label>
                <select
                    id="assign-driver"
                    value={driverId}
                    onChange={(e) => setDriverId(e.target.value)}
                >
                    <option value="">Escolha um motorista</option>
                    {available.map((d) => (
                        <option key={d.publicId} value={d.publicId}>
                            {d.name}
                        </option>
                    ))}
                </select>
                {drivers.isSuccess && available.length === 0 && (
                    <p className="field-help">Nenhum motorista disponível agora.</p>
                )}
            </div>
            <div className="field">
                <label htmlFor="assign-vehicle">Veículo (opcional)</label>
                <select
                    id="assign-vehicle"
                    value={vehicleId}
                    onChange={(e) => setVehicleId(e.target.value)}
                >
                    <option value="">Usar o veículo do motorista</option>
                    {freeVehicles.map((v) => (
                        <option key={v.publicId} value={v.publicId}>
                            {v.plate}
                        </option>
                    ))}
                </select>
            </div>
        </Modal>
    );
}

function PodModal({
    busy,
    onSubmit,
    onClose,
}: {
    busy: boolean;
    onSubmit: (value: string) => void;
    onClose: () => void;
}) {
    const [value, setValue] = useState("");
    return (
        <Modal
            title="Registrar prova de entrega"
            onClose={onClose}
            footer={
                <>
                    <button type="button" className="btn btn-secondary" onClick={onClose}>
                        Voltar
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary"
                        disabled={!value.trim() || busy}
                        onClick={() => onSubmit(value.trim())}
                    >
                        {busy && <Loader2 size={16} className="spin" aria-hidden="true" />}
                        Registrar
                    </button>
                </>
            }
        >
            <div className="field">
                <label htmlFor="pod-value">Prova de entrega</label>
                <input
                    id="pod-value"
                    value={value}
                    maxLength={255}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="Nome de quem recebeu, código ou observação"
                />
                <p className="field-help">{value.length}/255</p>
            </div>
        </Modal>
    );
}

export default function OrderDialogs({
    state,
    order: o,
}: {
    state: OrderDetailState;
    order: Order;
}) {
    const { dialog, setDialog, busy, run } = state;
    return (
        <>
            {dialog === "assign" && (
                <AssignModal
                    order={o}
                    busy={busy}
                    onClose={() => setDialog(null)}
                    onSubmit={(driverId, vehicleId) =>
                        run({
                            path: "assign",
                            body: { driverId, vehicleId },
                            done: "Motorista atribuído.",
                        })
                    }
                />
            )}
            {dialog === "pod" && (
                <PodModal
                    busy={busy}
                    onClose={() => setDialog(null)}
                    onSubmit={(value) =>
                        run({ path: "pod", body: { value }, done: "Prova de entrega registrada." })
                    }
                />
            )}
            {dialog === "fail" && (
                <ConfirmDialog
                    title="Marcar como falhou"
                    description="Descreva o que aconteceu. O motivo fica no histórico do pedido."
                    confirmLabel="Marcar como falhou"
                    destructive
                    askReason
                    reasonRequired
                    busy={busy}
                    onClose={() => setDialog(null)}
                    onConfirm={(reason) =>
                        run({
                            path: "activity",
                            body: { code: "FAILED", reason },
                            done: "Pedido marcado como falhou.",
                        })
                    }
                />
            )}
            {dialog === "cancel" && (
                <ConfirmDialog
                    title="Cancelar pedido"
                    description={`O pedido ${o.trackingNumber} será cancelado e o motorista liberado. Isso não pode ser desfeito.`}
                    confirmLabel="Cancelar pedido"
                    destructive
                    askReason
                    reasonRequired
                    busy={busy}
                    onClose={() => setDialog(null)}
                    onConfirm={(reason) =>
                        run({ path: "cancel", body: { reason }, done: "Pedido cancelado." })
                    }
                />
            )}
        </>
    );
}
