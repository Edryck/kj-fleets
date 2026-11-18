import { Truck } from "lucide-react";
import { Link } from "react-router-dom";
import StatusBadge from "../components/StatusBadge";
import { Skeleton } from "../components/blocks";
import Glass from "../glass/Glass";
import { vehicleName, type VehicleLike } from "../vehicles/catalog";
import VehicleShot from "../vehicles/VehicleShot";

const initials = (name: string) =>
    name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("");

export default function VehicleCard({
    plate,
    vehicle,
    status,
    lastSignal,
    driver,
    driverHref,
    loading,
}: {
    plate: string | null;
    vehicle?: VehicleLike | null;
    status?: string | null;
    lastSignal?: string | null;
    driver?: { name: string; status: string } | null;
    driverHref?: string;
    loading?: boolean;
}) {
    if (loading) {
        return (
            <Glass className="vehicle-card is-loading" aria-busy="true">
                <div className="vehicle-card-shot">
                    <Skeleton height={120} width="80%" />
                </div>
                <Skeleton height={26} width="55%" />
                <Skeleton height={14} width="35%" />
            </Glass>
        );
    }
    if (!plate) {
        return (
            <Glass className="vehicle-card is-empty">
                <p className="vehicle-card-empty">Sem veículo atribuído</p>
            </Glass>
        );
    }
    const trimmedType = vehicle?.type?.trim() ?? "";
    const name = vehicleName(vehicle ?? {});
    const named = Boolean(vehicle?.brand?.trim() || vehicle?.model?.trim());
    const kind = named && trimmedType ? `${name} · ${trimmedType}` : named ? name : trimmedType;
    return (
        <Glass className="vehicle-card">
            <div className="vehicle-card-shot">
                <VehicleShot
                    vehicle={vehicle}
                    view="34"
                    className="motion-drive"
                    alt={`${name} ${plate}`}
                    fallback={
                        <span className="vehicle-card-fallback">
                            <Truck size={28} aria-hidden="true" />
                            {trimmedType
                                ? `Sem imagem para “${trimmedType}”`
                                : "Sem imagem do veículo"}
                        </span>
                    }
                />
            </div>
            <div className="vehicle-card-meta">
                <span className="vehicle-card-plate">{plate}</span>
                {status && <StatusBadge kind="vehicle" value={status} />}
            </div>
            {(kind || lastSignal) && (
                <div className="vehicle-card-meta is-secondary">
                    <span>{kind}</span>
                    {lastSignal && <span>{lastSignal}</span>}
                </div>
            )}
            {driver && (
                <div className="vehicle-card-driver">
                    <span className="vehicle-card-avatar" aria-hidden="true">
                        {initials(driver.name)}
                    </span>
                    <span className="vehicle-card-driver-name">
                        <small>Motorista</small>
                        {driverHref ? <Link to={driverHref}>{driver.name}</Link> : driver.name}
                    </span>
                    <StatusBadge kind="driver" value={driver.status} />
                </div>
            )}
        </Glass>
    );
}
