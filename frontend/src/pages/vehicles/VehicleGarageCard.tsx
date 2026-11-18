import { Truck } from "lucide-react";
import type { CSSProperties } from "react";
import type { Vehicle } from "../../api/types";
import StatusBadge from "../../components/StatusBadge";
import Glass from "../../glass/Glass";
import { vehicleName } from "../../vehicles/catalog";
import VehicleShot from "../../vehicles/VehicleShot";

export default function VehicleGarageCard({
    vehicle,
    selected,
    onSelect,
    index = 0,
}: {
    vehicle: Vehicle;
    selected: boolean;
    onSelect: () => void;
    index?: number;
}) {
    const type = vehicle.type.trim();
    const name = vehicleName(vehicle);
    const label = name === "Veículo" ? "Sem tipo" : name;
    const classes = ["vcard", selected && "is-selected", !vehicle.active && "is-inactive"]
        .filter(Boolean)
        .join(" ");
    return (
        <Glass
            as="button"
            type="button"
            press
            className={classes}
            aria-pressed={selected}
            onClick={onSelect}
            style={{ "--i": Math.min(index, 12) } as CSSProperties}
        >
            <span className="vcard-top">
                <span className="vcard-plate">{vehicle.plate}</span>
                {vehicle.active ? (
                    <StatusBadge kind="vehicle" value={vehicle.status} />
                ) : (
                    <span className="vcard-chip">Inativo</span>
                )}
            </span>
            <span className="vcard-sub">
                {label} · {vehicle.driverName ?? "Sem motorista"}
            </span>
            <VehicleShot
                vehicle={vehicle}
                view="side"
                className="vcard-shot"
                alt={`${name} ${vehicle.plate}`}
                fallback={
                    <span className="vcard-none">
                        <Truck size={26} aria-hidden="true" />
                        <span>Sem imagem para “{type}”</span>
                    </span>
                }
            />
        </Glass>
    );
}
