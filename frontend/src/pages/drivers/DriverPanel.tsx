import { MapPinOff, Pencil, RotateCcw, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Driver } from "../../api/types";
import { formatAgo } from "../../components/format";
import StatusBadge from "../../components/StatusBadge";
import Avatar from "../../patterns/Avatar";
import { GlassMapFrame } from "../../patterns/GlassMapFrame";
import { SidePanel } from "../../patterns/SidePanel";
import VehicleCard from "../../patterns/VehicleCard";

function Row({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="rowline dp-row">
            <span>{label}</span>
            <b>{children}</b>
        </div>
    );
}

export function lastSignal(driver: Driver): string {
    return driver.lastSeenAt ? `Visto ${formatAgo(driver.lastSeenAt)}` : "Nunca enviou posição";
}

export function DriverHead({ driver }: { driver: Driver }) {
    return (
        <div className="dp-head">
            <Avatar name={driver.name} role="DRIVER" size="lg" />
            <div className="dp-who">
                <span className="dp-name">{driver.name}</span>
                <span className="dp-meta">
                    <StatusBadge kind="driver" value={driver.status} />
                    {!driver.active && <span className="badge badge-neutral">Inativo</span>}
                </span>
                <small>{lastSignal(driver)}</small>
            </div>
        </div>
    );
}

export function DriverPosition({ driver, className }: { driver: Driver; className?: string }) {
    if (driver.lat == null || driver.lng == null) {
        return (
            <p className={`dp-nopos${className ? ` ${className}` : ""}`}>
                <MapPinOff size={18} aria-hidden="true" />
                Sem posição
            </p>
        );
    }
    return (
        <GlassMapFrame
            key={driver.publicId}
            className={`dp-map${className ? ` ${className}` : ""}`}
            markers={[
                {
                    id: driver.publicId,
                    kind: "driver",
                    lat: driver.lat,
                    lng: driver.lng,
                    status: driver.status,
                    title: driver.name,
                    selected: true,
                },
            ]}
        />
    );
}

export default function DriverPanel({
    driver: d,
    canWrite,
    reactivating,
    onEdit,
    onRemove,
    onReactivate,
    onClose,
}: {
    driver: Driver;
    canWrite: boolean;
    reactivating: boolean;
    onEdit: () => void;
    onRemove: () => void;
    onReactivate: () => void;
    onClose: () => void;
}) {
    const footer = (
        <>
            <Link className="btn btn-secondary" to={`/drivers/${d.publicId}`}>
                Ver perfil
            </Link>
            {canWrite &&
                (d.active ? (
                    <>
                        <button type="button" className="btn btn-ghost" onClick={onEdit}>
                            <Pencil size={16} aria-hidden="true" />
                            Editar
                        </button>
                        <button
                            type="button"
                            className="btn btn-ghost btn-danger-ghost"
                            onClick={onRemove}
                        >
                            <Trash2 size={16} aria-hidden="true" />
                            Excluir
                        </button>
                    </>
                ) : (
                    <button
                        type="button"
                        className="btn btn-ghost"
                        disabled={reactivating}
                        onClick={onReactivate}
                    >
                        <RotateCcw size={16} aria-hidden="true" />
                        Reativar
                    </button>
                ))}
        </>
    );
    return (
        <SidePanel
            title={d.name}
            onClose={onClose}
            footer={footer}
            className="driver-panel has-hero"
        >
            <DriverHead driver={d} />
            <VehicleCard plate={d.vehicle?.plate ?? null} vehicle={d.vehicle} />
            <DriverPosition driver={d} />
            <div className="dp-rows">
                <Row label="Usuário">{d.username}</Row>
                <Row label="Telefone">{d.phone ?? "—"}</Row>
                <Row label="CNH">{d.licenseNumber ?? "—"}</Row>
                <Row label="Frotas">
                    {d.fleets.map((f) => f.name).join(", ") || "Nenhuma frota ativa"}
                </Row>
            </div>
        </SidePanel>
    );
}
