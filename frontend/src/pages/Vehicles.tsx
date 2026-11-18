import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, RotateCcw, Trash2, Truck } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { messageFor } from "../api/errors";
import { ApiError, request } from "../api/http";
import type { Page, Vehicle, VehicleStatus } from "../api/types";
import { useSession } from "../auth/session";
import { EmptyState, ErrorState, Skeleton } from "../components/blocks";
import CatalogFilters from "../components/CatalogFilters";
import { PAGE_SIZES, Pager } from "../components/DataTable";
import { ConfirmDialog } from "../components/overlays";
import StatusBadge from "../components/StatusBadge";
import { toast } from "../components/Toasts";
import Glass from "../glass/Glass";
import { useTotal, useTotals } from "../hooks/useTotals";
import { useTitleBlock } from "../layout/titleBlockContext";
import { SidePanel, SidePanelLayout } from "../patterns/SidePanel";
import { useTopic, type OrderEvent } from "../realtime/useTopic";
import {
    colorSwatch,
    findModel,
    fold,
    VEHICLE_COLORS,
    VEHICLE_MODELS,
    VEHICLE_TYPES,
    vehicleName,
} from "../vehicles/catalog";
import VehicleShot from "../vehicles/VehicleShot";
import VehicleGarageCard from "./vehicles/VehicleGarageCard";

const STATUSES: [string, string][] = [
    ["AVAILABLE", "Disponível"],
    ["IN_USE", "Em uso"],
    ["MAINTENANCE", "Manutenção"],
];
const STATUS_LABEL: Record<string, string> = Object.fromEntries(STATUSES);
const TOTAL_KEYS = ["AVAILABLE", "IN_USE", "MAINTENANCE"] as const;

type Panel = { mode: "detail" | "edit"; id: string } | { mode: "new" } | null;

interface FormValues {
    plate: string;
    type: string;
    status: VehicleStatus;
    brand: string;
    model: string;
    year: string;
    color: string;
    capacityKg: string;
    volumeM3: string;
    odometerKm: string;
}

const MISSING = "Não informado";
const numberFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const nextYear = () => new Date().getFullYear() + 1;
const asText = (value: string) => value.trim() || null;
const asInteger = (value: string) => {
    const clean = value.trim().replace(/\./g, "");
    return clean === "" ? null : Number(clean);
};
const asDecimal = (value: string) => {
    const clean = value.trim().replace(",", ".");
    return clean === "" ? null : Number(clean);
};
const fromNumber = (value: number | null | undefined) =>
    value == null ? "" : String(value).replace(".", ",");

function inRange(
    parse: (value: string) => number | null,
    min: number,
    max: number,
    message: string,
    integer = true,
) {
    return (value: string) => {
        const number = parse(value);
        if (number == null) return true;
        const valid =
            Number.isFinite(number) &&
            (!integer || Number.isInteger(number)) &&
            number >= min &&
            number <= max;
        return valid || message;
    };
}

function withUnit(value: number | null | undefined, unit: string) {
    return value == null ? MISSING : `${numberFormat.format(value)} ${unit}`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function invalidateVehicles(client: ReturnType<typeof useQueryClient>) {
    void client.invalidateQueries({ queryKey: ["vehicles"] });
    void client.invalidateQueries({ queryKey: ["/vehicles"] });
}

function VehicleForm({
    vehicle,
    onCancel,
    onSaved,
}: {
    vehicle: Vehicle | null;
    onCancel: () => void;
    onSaved: () => void;
}) {
    const client = useQueryClient();
    const form = useForm<FormValues>({
        defaultValues: {
            plate: vehicle?.plate ?? "",
            type: vehicle?.type ?? "",
            status: vehicle?.status === "IN_USE" ? "AVAILABLE" : (vehicle?.status ?? "AVAILABLE"),
            brand: vehicle?.brand ?? "",
            model: vehicle?.model ?? "",
            year: vehicle?.year == null ? "" : String(vehicle.year),
            color: vehicle?.color ?? "",
            capacityKg: vehicle?.capacityKg == null ? "" : String(vehicle.capacityKg),
            volumeM3: fromNumber(vehicle?.volumeM3),
            odometerKm: vehicle?.odometerKm == null ? "" : String(vehicle.odometerKm),
        },
    });
    const { register, handleSubmit, setError, setValue, watch, formState } = form;
    const inUse = vehicle?.status === "IN_USE";
    const [type, brand, model] = watch(["type", "brand", "model"]);
    const legacyType =
        vehicle?.type && !(VEHICLE_TYPES as readonly string[]).includes(vehicle.type);
    const legacyColor =
        vehicle?.color && !VEHICLE_COLORS.some((c) => fold(c.name) === fold(vehicle.color));
    const forType = VEHICLE_MODELS.filter((m) => !type || m.type === type);
    const brands = [...new Set(forType.map((m) => m.brand))];
    const models = forType.filter((m) => !brand.trim() || fold(m.brand) === fold(brand));
    const year = nextYear();

    const matchKey = findModel(brand, model)?.key ?? "";
    const lastMatch = useRef(matchKey);
    useEffect(() => {
        if (matchKey === lastMatch.current) return;
        lastMatch.current = matchKey;
        const match = findModel(brand, model);
        if (match) setValue("type", match.type, { shouldDirty: true });
    }, [matchKey, brand, model, setValue]);

    const save = useMutation({
        mutationFn: (body: object) =>
            vehicle
                ? request<Vehicle>("PUT", `/vehicles/${vehicle.publicId}`, body)
                : request<Vehicle>("POST", "/vehicles", body),
        onSuccess: () => {
            toast.success(vehicle ? "Veículo atualizado." : "Veículo cadastrado.");
            invalidateVehicles(client);
            void client.invalidateQueries({ queryKey: ["drivers"] });
            onSaved();
        },
        onError: (e: ApiError) => {
            const message = messageFor(e.code, e.message);
            if (e.code === "PLATE_TAKEN") setError("plate", { message });
            else setError("root", { message });
        },
    });

    return (
        <SidePanel
            title={vehicle ? "Editar veículo" : "Novo veículo"}
            onClose={onCancel}
            footer={
                <>
                    <button type="button" className="btn btn-secondary" onClick={onCancel}>
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        form="vehicle-form"
                        className="btn btn-primary"
                        disabled={save.isPending}
                    >
                        {save.isPending && (
                            <Loader2 size={16} className="spin" aria-hidden="true" />
                        )}
                        {vehicle ? "Salvar veículo" : "Cadastrar veículo"}
                    </button>
                </>
            }
        >
            <form
                id="vehicle-form"
                className="stack"
                noValidate
                onSubmit={handleSubmit((v) =>
                    save.mutate({
                        plate: v.plate.trim(),
                        type: v.type.trim(),
                        status: inUse ? undefined : v.status,
                        brand: asText(v.brand),
                        model: asText(v.model),
                        year: asInteger(v.year),
                        color: asText(v.color),
                        capacityKg: asInteger(v.capacityKg),
                        volumeM3: asDecimal(v.volumeM3),
                        odometerKm: asInteger(v.odometerKm),
                    }),
                )}
            >
                {formState.errors.root && (
                    <p className="notice notice-danger" role="alert">
                        {formState.errors.root.message}
                    </p>
                )}
                <div className="field">
                    <label htmlFor="vehicle-plate">Placa</label>
                    <input
                        id="vehicle-plate"
                        className="data"
                        aria-invalid={!!formState.errors.plate}
                        {...register("plate", {
                            validate: (v) => v.trim() !== "" || "Informe a placa",
                        })}
                    />
                    {formState.errors.plate && (
                        <p className="field-error">{formState.errors.plate.message}</p>
                    )}
                </div>
                <div className="field">
                    <label htmlFor="vehicle-type">Tipo</label>
                    <select
                        id="vehicle-type"
                        aria-invalid={!!formState.errors.type}
                        {...register("type", {
                            validate: (v) => v.trim() !== "" || "Escolha o tipo",
                        })}
                    >
                        <option value="" disabled>
                            Escolha o tipo
                        </option>
                        {VEHICLE_TYPES.map((t) => (
                            <option key={t} value={t}>
                                {t}
                            </option>
                        ))}
                        {legacyType && <option value={vehicle.type}>{vehicle.type}</option>}
                    </select>
                    {formState.errors.type && (
                        <p className="field-error">{formState.errors.type.message}</p>
                    )}
                </div>
                <div className="field-row">
                    <div className="field">
                        <label htmlFor="vehicle-brand">Marca</label>
                        <input
                            id="vehicle-brand"
                            list="vehicle-brands"
                            maxLength={40}
                            autoComplete="off"
                            {...register("brand")}
                        />
                        <datalist id="vehicle-brands">
                            {brands.map((b) => (
                                <option key={b} value={b} />
                            ))}
                        </datalist>
                    </div>
                    <div className="field">
                        <label htmlFor="vehicle-model">Modelo</label>
                        <input
                            id="vehicle-model"
                            list="vehicle-models"
                            maxLength={60}
                            autoComplete="off"
                            {...register("model")}
                        />
                        <datalist id="vehicle-models">
                            {models.map((m) => (
                                <option key={m.key} value={m.model} />
                            ))}
                        </datalist>
                    </div>
                </div>
                <p className="field-help vehicle-form-help">
                    Um modelo conhecido escolhe o tipo e o desenho 3D sozinho.
                </p>
                <div className="field-row">
                    <div className="field">
                        <label htmlFor="vehicle-year">Ano</label>
                        <input
                            id="vehicle-year"
                            className="data"
                            inputMode="numeric"
                            aria-invalid={!!formState.errors.year}
                            {...register("year", {
                                validate: inRange(
                                    asInteger,
                                    1980,
                                    year,
                                    `Use um ano entre 1980 e ${year}`,
                                ),
                            })}
                        />
                        {formState.errors.year && (
                            <p className="field-error">{formState.errors.year.message}</p>
                        )}
                    </div>
                    <div className="field">
                        <label htmlFor="vehicle-color">Cor</label>
                        <select id="vehicle-color" {...register("color")}>
                            <option value="">Não informada</option>
                            {VEHICLE_COLORS.map((c) => (
                                <option key={c.name} value={c.name}>
                                    {c.name}
                                </option>
                            ))}
                            {legacyColor && <option value={vehicle.color!}>{vehicle.color}</option>}
                        </select>
                    </div>
                </div>
                <div className="field-row">
                    <div className="field">
                        <label htmlFor="vehicle-capacity">Capacidade (kg)</label>
                        <input
                            id="vehicle-capacity"
                            className="data"
                            inputMode="numeric"
                            aria-invalid={!!formState.errors.capacityKg}
                            {...register("capacityKg", {
                                validate: inRange(asInteger, 1, 60000, "Use de 1 a 60.000 kg"),
                            })}
                        />
                        {formState.errors.capacityKg && (
                            <p className="field-error">{formState.errors.capacityKg.message}</p>
                        )}
                    </div>
                    <div className="field">
                        <label htmlFor="vehicle-volume">Volume (m³)</label>
                        <input
                            id="vehicle-volume"
                            className="data"
                            inputMode="decimal"
                            aria-invalid={!!formState.errors.volumeM3}
                            {...register("volumeM3", {
                                validate: inRange(
                                    asDecimal,
                                    0.1,
                                    150,
                                    "Use de 0,1 a 150 m³",
                                    false,
                                ),
                            })}
                        />
                        {formState.errors.volumeM3 && (
                            <p className="field-error">{formState.errors.volumeM3.message}</p>
                        )}
                    </div>
                </div>
                <div className="field">
                    <label htmlFor="vehicle-odometer">Hodômetro (km)</label>
                    <input
                        id="vehicle-odometer"
                        className="data"
                        inputMode="numeric"
                        aria-invalid={!!formState.errors.odometerKm}
                        {...register("odometerKm", {
                            validate: inRange(asInteger, 0, 5000000, "Use de 0 a 5.000.000 km"),
                        })}
                    />
                    {formState.errors.odometerKm && (
                        <p className="field-error">{formState.errors.odometerKm.message}</p>
                    )}
                </div>
                <div className="field">
                    <label htmlFor="vehicle-status">Status</label>
                    <select id="vehicle-status" disabled={inUse} {...register("status")}>
                        {inUse && (
                            <option value="IN_USE" disabled>
                                Em uso
                            </option>
                        )}
                        <option value="AVAILABLE">Disponível</option>
                        <option value="MAINTENANCE">Manutenção</option>
                    </select>
                    {inUse && (
                        <p className="field-help">
                            Em uso: o status volta sozinho ao fim do pedido.
                        </p>
                    )}
                </div>
            </form>
        </SidePanel>
    );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="rowline vdetail-row">
            <span>{label}</span>
            <b>{children}</b>
        </div>
    );
}

function VehicleDetail({
    vehicle,
    canWrite,
    reactivating,
    onEdit,
    onRemove,
    onReactivate,
    onClose,
}: {
    vehicle: Vehicle;
    canWrite: boolean;
    reactivating: boolean;
    onEdit: () => void;
    onRemove: () => void;
    onReactivate: () => void;
    onClose: () => void;
}) {
    const type = vehicle.type.trim();
    const name = vehicleName(vehicle);
    const named = Boolean(vehicle.brand?.trim() || vehicle.model?.trim());
    const actions = canWrite ? (
        vehicle.active ? (
            <>
                <button type="button" className="btn btn-secondary" onClick={onEdit}>
                    <Pencil size={16} aria-hidden="true" />
                    Editar
                </button>
                <button type="button" className="btn btn-ghost btn-danger-ghost" onClick={onRemove}>
                    <Trash2 size={16} aria-hidden="true" />
                    Excluir
                </button>
            </>
        ) : (
            <button
                type="button"
                className="btn btn-secondary"
                disabled={reactivating}
                onClick={onReactivate}
            >
                <RotateCcw size={16} aria-hidden="true" />
                Reativar
            </button>
        )
    ) : undefined;
    return (
        <SidePanel
            title={vehicle.plate}
            onClose={onClose}
            footer={actions}
            className="vdetail has-hero"
        >
            <div className="vdetail-shot">
                <VehicleShot
                    key={vehicle.publicId}
                    vehicle={vehicle}
                    view="34"
                    className="motion-drive"
                    alt={`${name} ${vehicle.plate}`}
                    eager
                    fallback={
                        <span className="vcard-none">
                            <Truck size={30} aria-hidden="true" />
                            <span>Sem imagem para “{type}”</span>
                        </span>
                    }
                />
            </div>
            <div className="vdetail-head">
                <span className="vdetail-plate">{vehicle.plate}</span>
                <span className="vdetail-meta">
                    <span>{named ? `${name} · ${type || "Sem tipo"}` : type || "Sem tipo"}</span>
                    <StatusBadge kind="vehicle" value={vehicle.status} />
                </span>
            </div>
            <div className="vdetail-rows">
                <Row label="Marca e modelo">{named ? name : MISSING}</Row>
                <Row label="Ano">{vehicle.year ?? MISSING}</Row>
                <Row label="Cor">
                    {vehicle.color ? (
                        <span className="vdetail-color">
                            <i
                                aria-hidden="true"
                                style={{ background: colorSwatch(vehicle.color) ?? "transparent" }}
                            />
                            {vehicle.color}
                        </span>
                    ) : (
                        MISSING
                    )}
                </Row>
                <Row label="Capacidade">{withUnit(vehicle.capacityKg, "kg")}</Row>
                <Row label="Volume">{withUnit(vehicle.volumeM3, "m³")}</Row>
                <Row label="Hodômetro">{withUnit(vehicle.odometerKm, "km")}</Row>
                <Row label="Motorista atual">{vehicle.driverName ?? "Nenhum"}</Row>
                <Row label="Status">{STATUS_LABEL[vehicle.status] ?? vehicle.status}</Row>
                <Row label="Cadastro">{vehicle.active ? "Ativo" : "Inativo"}</Row>
            </div>
        </SidePanel>
    );
}

export default function Vehicles() {
    const client = useQueryClient();
    const session = useSession();
    const canWrite = session?.role === "ADMIN" || session?.role === "FLEET_MANAGER";
    const [q, setQ] = useState("");
    const [status, setStatus] = useState("");
    const [includeInactive, setIncludeInactive] = useState(false);
    const [limit, setLimit] = useState(20);
    const [offset, setOffset] = useState(0);
    const [panel, setPanel] = useState<Panel>(null);
    const [removing, setRemoving] = useState<Vehicle | null>(null);
    const filtered = Boolean(q || status);

    const changeQuery = useCallback((value: string) => {
        setQ(value);
        setOffset(0);
    }, []);

    const vehicles = useQuery({
        queryKey: ["vehicles", q, status, includeInactive, limit, offset],
        queryFn: () =>
            request<Page<Vehicle>>("GET", "/vehicles", undefined, {
                q,
                status,
                includeInactive: includeInactive || undefined,
                limit,
                offset,
            }),
        placeholderData: (previous) => previous,
    });
    const totals = useTotals("/vehicles", "status", TOTAL_KEYS);
    const all = useTotal("/vehicles");

    useTopic<OrderEvent>("/topic/orders", () => invalidateVehicles(client));

    const remove = useMutation({
        mutationFn: (vehicle: Vehicle) => request<void>("DELETE", `/vehicles/${vehicle.publicId}`),
        onSuccess: (_data, vehicle) => {
            toast.success("Veículo excluído.");
            invalidateVehicles(client);
            setPanel((current) =>
                current && current.mode !== "new" && current.id === vehicle.publicId
                    ? null
                    : current,
            );
        },
        onError: (e: ApiError) => toast.error(messageFor(e.code, e.message)),
    });
    const reactivate = useMutation({
        mutationFn: (vehicle: Vehicle) =>
            request<Vehicle>("POST", `/vehicles/${vehicle.publicId}/reactivate`),
        onSuccess: () => {
            toast.success("Veículo reativado.");
            invalidateVehicles(client);
        },
        onError: (e: ApiError) => toast.error(messageFor(e.code, e.message)),
    });

    useTitleBlock({
        title: "Veículos",
        meta:
            all != null ? (
                <>
                    <span>{plural(all, "veículo", "veículos")}</span>
                    {totals.AVAILABLE != null && (
                        <span>{plural(totals.AVAILABLE, "disponível", "disponíveis")}</span>
                    )}
                    {totals.IN_USE != null && <span>{totals.IN_USE} em uso</span>}
                    {totals.MAINTENANCE != null && <span>{totals.MAINTENANCE} em manutenção</span>}
                </>
            ) : undefined,
    });

    const items = vehicles.data?.items;
    const selectedId = panel && panel.mode !== "new" ? panel.id : null;
    const selected = selectedId ? items?.find((v) => v.publicId === selectedId) : undefined;
    const closePanel = () => setPanel(null);

    const add = (
        <button type="button" className="btn btn-primary" onClick={() => setPanel({ mode: "new" })}>
            <Plus size={18} aria-hidden="true" />
            Novo veículo
        </button>
    );

    let panelNode: ReactNode = null;
    if (panel?.mode === "new") {
        panelNode = <VehicleForm vehicle={null} onCancel={closePanel} onSaved={closePanel} />;
    } else if (panel && selected) {
        const toDetail = () => setPanel({ mode: "detail", id: selected.publicId });
        panelNode =
            panel.mode === "edit" ? (
                <VehicleForm
                    key={selected.publicId}
                    vehicle={selected}
                    onCancel={toDetail}
                    onSaved={toDetail}
                />
            ) : (
                <VehicleDetail
                    vehicle={selected}
                    canWrite={canWrite}
                    reactivating={reactivate.isPending}
                    onEdit={() => setPanel({ mode: "edit", id: selected.publicId })}
                    onRemove={() => setRemoving(selected)}
                    onReactivate={() => reactivate.mutate(selected)}
                    onClose={closePanel}
                />
            );
    }

    let body: ReactNode;
    if (vehicles.isError) {
        const e = vehicles.error as ApiError;
        body = (
            <ErrorState
                message={messageFor(e.code, e.message)}
                onRetry={() => vehicles.refetch()}
            />
        );
    } else if (!items) {
        body = (
            <div className="vgrid" aria-busy="true">
                {Array.from({ length: 6 }, (_, i) => (
                    <Glass key={i} className="vcard is-loading">
                        <Skeleton height={20} width="55%" />
                        <Skeleton height={14} width="70%" />
                        <span className="vcard-skeleton-shot">
                            <Skeleton height={86} />
                        </span>
                    </Glass>
                ))}
            </div>
        );
    } else if (items.length === 0) {
        body = (
            <EmptyState
                icon={Truck}
                title={filtered ? "Nenhum veículo com esses filtros" : "Nenhum veículo"}
                description={
                    filtered
                        ? "Troque o status ou a busca para ver outros veículos."
                        : "Cadastre o primeiro veículo da frota."
                }
                action={!filtered && canWrite ? add : undefined}
            />
        );
    } else {
        body = (
            <>
                <div className="vgrid">
                    {items.map((v, i) => (
                        <VehicleGarageCard
                            key={v.publicId}
                            vehicle={v}
                            index={i}
                            selected={v.publicId === selectedId}
                            onSelect={() =>
                                setPanel(
                                    v.publicId === selectedId
                                        ? null
                                        : { mode: "detail", id: v.publicId },
                                )
                            }
                        />
                    ))}
                </div>
                {(vehicles.data?.total ?? 0) > PAGE_SIZES[0] && (
                    <Glass className="garage-pager">
                        <Pager
                            total={vehicles.data?.total ?? 0}
                            limit={limit}
                            offset={offset}
                            onPage={(o, l) => {
                                setOffset(o);
                                setLimit(l);
                            }}
                        />
                    </Glass>
                )}
            </>
        );
    }

    return (
        <SidePanelLayout open={panelNode != null} panel={panelNode}>
            <div className="garage">
                <CatalogFilters
                    searchLabel="Buscar veículos"
                    placeholder="Buscar por placa, tipo ou modelo"
                    onQuery={changeQuery}
                    statuses={STATUSES}
                    status={status}
                    onStatus={(value) => {
                        setStatus(value);
                        setOffset(0);
                    }}
                    includeInactive={includeInactive}
                    onIncludeInactive={(on) => {
                        setIncludeInactive(on);
                        setOffset(0);
                    }}
                    counts={totals}
                    total={all}
                    action={canWrite ? add : undefined}
                />
                <div className="garage-scroll">{body}</div>
            </div>
            {removing && (
                <ConfirmDialog
                    title="Excluir veículo"
                    description={`${removing.plate} sai da lista e deixa de ser oferecido no despacho.`}
                    confirmLabel="Excluir veículo"
                    destructive
                    busy={remove.isPending}
                    onClose={() => setRemoving(null)}
                    onConfirm={() =>
                        remove.mutate(removing, { onSettled: () => setRemoving(null) })
                    }
                />
            )}
        </SidePanelLayout>
    );
}
