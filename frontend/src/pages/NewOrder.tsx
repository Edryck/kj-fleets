import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    ArrowDown,
    ArrowLeft,
    ArrowUp,
    ChevronDown,
    Crosshair,
    Loader2,
    Plus,
    Trash2,
    X,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFieldArray, useForm, useFormContext, FormProvider } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { messageFor } from "../api/errors";
import { ApiError, request } from "../api/http";
import type {
    CreateOrderRequest,
    Customer,
    OrderDetail,
    Page,
    Place,
    PointRequest,
} from "../api/types";
import { useSession } from "../auth/session";
import { type MapMarker } from "../components/MapView";
import { toast } from "../components/Toasts";
import Glass from "../glass/Glass";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useTitleBlock } from "../layout/titleBlockContext";
import GlassMapFrame from "../patterns/GlassMapFrame";

export const MAX_WAYPOINTS = 50;
export const MAX_ITEMS = 100;

interface PointValues {
    mode: "place" | "manual";
    place: Place | null;
    name: string;
    address: string;
    lat: string;
    lng: string;
}

interface FormValues {
    customerId: string;
    pickup: PointValues;
    dropoff: PointValues;
    waypoints: PointValues[];
    items: { name: string; quantity: number }[];
    podRequired: boolean;
    notes: string;
}

const emptyPoint = (mode: PointValues["mode"]): PointValues => ({
    mode,
    place: null,
    name: "",
    address: "",
    lat: "",
    lng: "",
});

const requiredText = (message: string) => ({
    validate: (v: string) => v.trim() !== "" || message,
});
const range = (min: number, max: number, empty: string, invalid: string) => ({
    validate: (v: string) => {
        if (v.trim() === "") return empty;
        const n = Number(v.replace(",", "."));
        return (Number.isFinite(n) && n >= min && n <= max) || invalid;
    },
});

type PointPath = "pickup" | "dropoff" | `waypoints.${number}`;

function toNumber(v: string) {
    return Number(v.replace(",", "."));
}

function PointFields({
    path,
    label,
    placesPath,
    picking,
    onPick,
    extra,
}: {
    path: PointPath;
    label: string;
    placesPath: string;
    picking: boolean;
    onPick: () => void;
    extra?: ReactNode;
}) {
    const { register, watch, setValue, formState } = useFormContext<FormValues>();
    const point = watch(path);
    const errors = path.includes(".")
        ? formState.errors.waypoints?.[Number(path.split(".")[1])]
        : formState.errors[path as "pickup" | "dropoff"];
    const [search, setSearch] = useState("");
    const [debounced, setDebounced] = useState("");
    const [focused, setFocused] = useState(false);
    useEffect(() => {
        const timer = setTimeout(() => setDebounced(search.trim()), 300);
        return () => clearTimeout(timer);
    }, [search]);

    const places = useQuery({
        queryKey: [placesPath, debounced],
        queryFn: () =>
            request<Page<Place>>("GET", placesPath, undefined, { q: debounced, limit: 8 }),
        enabled: point.mode === "place" && focused,
    });

    const setMode = (mode: PointValues["mode"]) => setValue(`${path}.mode`, mode);
    const choose = (place: Place) => {
        setValue(`${path}.place`, place, { shouldValidate: true });
        setSearch("");
    };

    return (
        <fieldset className="point">
            <legend>{label}</legend>
            {extra}
            <div className="segmented" role="group" aria-label={`Tipo de ponto: ${label}`}>
                <button
                    type="button"
                    aria-pressed={point.mode === "place"}
                    onClick={() => setMode("place")}
                >
                    {placesPath === "/places" ? "Lugar cadastrado" : "Meu endereço"}
                </button>
                <button
                    type="button"
                    aria-pressed={point.mode === "manual"}
                    onClick={() => setMode("manual")}
                >
                    Novo ponto
                </button>
            </div>

            {point.mode === "place" ? (
                <div className="field">
                    <input
                        type="hidden"
                        {...register(`${path}.place`, {
                            validate: (v) => !!v || `Escolha o lugar: ${label.toLowerCase()}`,
                        })}
                    />
                    {point.place ? (
                        <div className="place-chip">
                            <div>
                                <strong>{point.place.name}</strong>
                                <div className="caption">{point.place.address}</div>
                            </div>
                            <button
                                type="button"
                                className="btn btn-ghost btn-icon"
                                aria-label={`Trocar lugar: ${label}`}
                                onClick={() => setValue(`${path}.place`, null)}
                            >
                                <X size={16} aria-hidden="true" />
                            </button>
                        </div>
                    ) : (
                        <>
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onFocus={() => setFocused(true)}
                                placeholder="Buscar lugar pelo nome"
                                aria-label={`Buscar lugar: ${label}`}
                                aria-invalid={!!errors?.place}
                            />
                            {places.data && (
                                <ul className="place-results">
                                    {places.data.items.length === 0 && (
                                        <li className="caption">
                                            {placesPath === "/places"
                                                ? "Nenhum lugar encontrado"
                                                : 'Nenhum endereço encontrado. Use "Novo ponto" e ele fica salvo em Meus endereços.'}
                                        </li>
                                    )}
                                    {places.data.items.map((p) => (
                                        <li key={p.publicId}>
                                            <button type="button" onClick={() => choose(p)}>
                                                <strong>{p.name}</strong>
                                                <span className="caption">{p.address}</span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </>
                    )}
                    {errors?.place && (
                        <p className="field-error">{errors.place.message as string}</p>
                    )}
                </div>
            ) : (
                <div className="point-grid">
                    <div className="field">
                        <label htmlFor={`${path}-name`}>Nome</label>
                        <input
                            id={`${path}-name`}
                            aria-invalid={!!errors?.name}
                            {...register(`${path}.name`, requiredText("Informe o nome"))}
                        />
                        {errors?.name && <p className="field-error">{errors.name.message}</p>}
                    </div>
                    <div className="field">
                        <label htmlFor={`${path}-address`}>Endereço</label>
                        <input
                            id={`${path}-address`}
                            aria-invalid={!!errors?.address}
                            {...register(`${path}.address`, requiredText("Informe o endereço"))}
                        />
                        {errors?.address && <p className="field-error">{errors.address.message}</p>}
                    </div>
                    <div className="field">
                        <label htmlFor={`${path}-lat`}>Latitude</label>
                        <input
                            id={`${path}-lat`}
                            inputMode="decimal"
                            className="data"
                            aria-invalid={!!errors?.lat}
                            {...register(
                                `${path}.lat`,
                                range(-90, 90, "Informe a latitude", "Latitude entre -90 e 90"),
                            )}
                        />
                        {errors?.lat && <p className="field-error">{errors.lat.message}</p>}
                    </div>
                    <div className="field">
                        <label htmlFor={`${path}-lng`}>Longitude</label>
                        <input
                            id={`${path}-lng`}
                            inputMode="decimal"
                            className="data"
                            aria-invalid={!!errors?.lng}
                            {...register(
                                `${path}.lng`,
                                range(
                                    -180,
                                    180,
                                    "Informe a longitude",
                                    "Longitude entre -180 e 180",
                                ),
                            )}
                        />
                        {errors?.lng && <p className="field-error">{errors.lng.message}</p>}
                    </div>
                    <button
                        type="button"
                        className={`btn btn-secondary point-pick${picking ? " is-active" : ""}`}
                        aria-pressed={picking}
                        onClick={onPick}
                    >
                        <Crosshair size={16} aria-hidden="true" />
                        {picking ? "Clique no mapa" : "Escolher no mapa"}
                    </button>
                </div>
            )}
        </fieldset>
    );
}

function RouteStep({
    kind,
    label,
    placed,
    last = false,
    children,
}: {
    kind: "pickup" | "waypoint" | "dropoff";
    label: string;
    placed: boolean;
    last?: boolean;
    children: ReactNode;
}) {
    const state = placed ? "done" : "todo";
    return (
        <li className={`stop-timeline-item route-step is-${state}${last ? " is-last" : ""}`}>
            <span className="stop-timeline-node" aria-hidden="true">
                <span className={`stop-timeline-orb is-${state} is-${kind}`}>
                    <span>{label}</span>
                </span>
            </span>
            <div className="route-step-body">
                <span className="sr-only">{placed ? "no mapa" : "sem localização"}</span>
                {children}
            </div>
        </li>
    );
}

export default function NewOrder() {
    const navigate = useNavigate();
    const client = useQueryClient();
    const session = useSession();
    const isCustomer = session?.role === "CUSTOMER";
    const startMode = "place";
    const placesPath = isCustomer ? "/customer/places" : "/places";
    const form = useForm<FormValues>({
        defaultValues: {
            customerId: "",
            pickup: emptyPoint(startMode),
            dropoff: emptyPoint(startMode),
            waypoints: [],
            items: [],
            podRequired: false,
            notes: "",
        },
    });
    const { register, handleSubmit, control, watch, setValue, setError, formState } = form;
    const waypoints = useFieldArray({ control, name: "waypoints" });
    const items = useFieldArray({ control, name: "items" });
    const [picking, setPicking] = useState<PointPath | null>(null);

    const [customerSearch, setCustomerSearch] = useState("");
    const [customerQuery, setCustomerQuery] = useState("");
    useEffect(() => {
        const timer = setTimeout(() => setCustomerQuery(customerSearch.trim()), 300);
        return () => clearTimeout(timer);
    }, [customerSearch]);
    const customers = useQuery({
        queryKey: ["customers", customerQuery],
        queryFn: () =>
            request<Page<Customer>>("GET", "/customers", undefined, {
                q: customerQuery,
                limit: 20,
            }),
        enabled: !isCustomer,
    });

    const values = watch();
    const notesLength = values.notes?.length ?? 0;

    const markers = ((): MapMarker[] => {
        const coords = (p: PointValues | undefined): [number, number] | null => {
            if (!p) return null;
            if (p.mode === "place") {
                return p.place?.lat != null && p.place.lng != null
                    ? [p.place.lat, p.place.lng]
                    : null;
            }
            const lat = toNumber(p.lat);
            const lng = toNumber(p.lng);
            const ok = p.lat.trim() && p.lng.trim() && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
            return ok ? [lat, lng] : null;
        };
        const list: [string, MapMarker["kind"], string, PointValues | undefined][] = [
            ["pickup", "pickup", "R", values.pickup],
            ...(values.waypoints ?? []).map(
                (w, i): [string, MapMarker["kind"], string, PointValues] => [
                    `w${i}`,
                    "waypoint",
                    String(i + 1),
                    w,
                ],
            ),
            ["dropoff", "dropoff", "E", values.dropoff],
        ];
        return list.flatMap(([id, kind, label, p]) => {
            const c = coords(p);
            return c ? [{ id, kind, label, lat: c[0], lng: c[1] }] : [];
        });
    })();

    const pickLabel =
        picking === "pickup"
            ? "retirada"
            : picking === "dropoff"
              ? "entrega"
              : picking
                ? `parada ${Number(picking.split(".")[1]) + 1}`
                : "";

    const create = useMutation({
        mutationFn: (body: CreateOrderRequest) => request<OrderDetail>("POST", "/orders", body),
        onSuccess: (order) => {
            toast.success("Pedido criado.");
            if (isCustomer) void client.invalidateQueries({ queryKey: ["/customer/places"] });
            navigate(`/orders/${order.publicId}`);
        },
        onError: (e: ApiError) => setError("root", { message: messageFor(e.code, e.message) }),
    });

    const point = (p: PointValues): PointRequest =>
        p.mode === "place" && p.place
            ? { placeId: p.place.publicId }
            : {
                  name: p.name.trim(),
                  address: p.address.trim(),
                  lat: toNumber(p.lat),
                  lng: toNumber(p.lng),
              };

    const onSubmit = (v: FormValues) =>
        create.mutate({
            customerId: !isCustomer && v.customerId ? v.customerId : undefined,
            pickup: point(v.pickup),
            dropoff: point(v.dropoff),
            waypoints: v.waypoints.map(point),
            items: v.items.map((i) => ({ name: i.name.trim(), quantity: Number(i.quantity) })),
            podRequired: v.podRequired,
            notes: v.notes.trim() || undefined,
        });

    function handlePick(lat: number, lng: number) {
        if (!picking) return;
        setValue(`${picking}.mode`, "manual");
        setValue(`${picking}.lat`, lat.toFixed(6), { shouldValidate: true });
        setValue(`${picking}.lng`, lng.toFixed(6), { shouldValidate: true });
        setPicking(null);
    }

    const pickProps = (path: PointPath) => ({
        path,
        placesPath,
        picking: picking === path,
        onPick: () => setPicking(picking === path ? null : path),
    });

    const placed = new Set(markers.map((m) => m.id));
    const totalPoints = 2 + waypoints.fields.length;
    const narrow = useMediaQuery("(max-width: 1023px)");
    const [previewOpen, setPreviewOpen] = useState(false);
    const preview = useRef<HTMLElement>(null);
    const showMap = !narrow || previewOpen || picking !== null;

    useEffect(() => {
        if (!picking || !narrow) return;
        preview.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, [picking, narrow]);

    useTitleBlock({
        title: "Novo pedido",
        meta: "Informe retirada, entrega e carga. As paradas seguem a ordem da lista.",
        actions: (
            <Link className="btn btn-secondary" to="/orders">
                <ArrowLeft size={16} aria-hidden="true" />
                Voltar
            </Link>
        ),
    });

    const stopTools = (index: number) => (
        <div className="point-tools">
            <button
                type="button"
                className="btn btn-ghost btn-icon btn-sm"
                aria-label={`Subir parada ${index + 1}`}
                disabled={index === 0}
                onClick={() => waypoints.move(index, index - 1)}
            >
                <ArrowUp size={16} aria-hidden="true" />
            </button>
            <button
                type="button"
                className="btn btn-ghost btn-icon btn-sm"
                aria-label={`Descer parada ${index + 1}`}
                disabled={index === waypoints.fields.length - 1}
                onClick={() => waypoints.move(index, index + 1)}
            >
                <ArrowDown size={16} aria-hidden="true" />
            </button>
            <button
                type="button"
                className="btn btn-ghost btn-icon btn-sm"
                aria-label={`Remover parada ${index + 1}`}
                onClick={() => waypoints.remove(index)}
            >
                <Trash2 size={16} aria-hidden="true" />
            </button>
        </div>
    );

    // o foco automático do react-hook-form não alcança erros sem input (ex.: lugar não escolhido)
    const focusFirstError = () =>
        requestAnimationFrame(() => {
            const error = document.querySelector(".new-order .field-error");
            const field = error
                ?.closest(".field, fieldset")
                ?.querySelector<HTMLElement>("input, select, textarea");
            field?.focus();
            field?.scrollIntoView({ block: "center" });
        });

    return (
        <FormProvider {...form}>
            <form
                onSubmit={handleSubmit(onSubmit, focusFirstError)}
                noValidate
                className="new-order"
            >
                <div className="no-sections">
                    {formState.errors.root && (
                        <p className="notice notice-danger" role="alert">
                            {formState.errors.root.message}
                        </p>
                    )}

                    {!isCustomer && (
                        <Glass as="section" className="no-section">
                            <h2>Cliente</h2>
                            <p className="field-help">
                                Opcional. Deixe em branco para um pedido sem cliente.
                            </p>
                            <div className="field-row">
                                <input
                                    value={customerSearch}
                                    onChange={(e) => setCustomerSearch(e.target.value)}
                                    placeholder="Buscar por nome ou e-mail"
                                    aria-label="Buscar cliente"
                                />
                                <select aria-label="Cliente" {...register("customerId")}>
                                    <option value="">Sem cliente</option>
                                    {customers.data?.items.map((c) => (
                                        <option key={c.publicId} value={c.publicId}>
                                            {c.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </Glass>
                    )}

                    <Glass as="section" className="no-section no-route">
                        <div className="no-section-head">
                            <h2>Rota</h2>
                            <span className="micro">
                                {placed.size} de {totalPoints} no mapa
                            </span>
                        </div>
                        <ol className="stop-timeline route-builder" aria-label="Paradas">
                            <RouteStep kind="pickup" label="R" placed={placed.has("pickup")}>
                                <PointFields {...pickProps("pickup")} label="Retirada" />
                            </RouteStep>
                            {waypoints.fields.map((field, index) => (
                                <RouteStep
                                    key={field.id}
                                    kind="waypoint"
                                    label={String(index + 1)}
                                    placed={placed.has(`w${index}`)}
                                >
                                    <PointFields
                                        {...pickProps(`waypoints.${index}`)}
                                        label={`Parada ${index + 1}`}
                                        extra={stopTools(index)}
                                    />
                                </RouteStep>
                            ))}
                            <li className="route-builder-add" role="none">
                                <span className="route-builder-add-node" aria-hidden="true">
                                    <Plus size={13} strokeWidth={2.5} />
                                </span>
                                <div>
                                    <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        disabled={waypoints.fields.length >= MAX_WAYPOINTS}
                                        onClick={() => waypoints.append(emptyPoint("manual"))}
                                    >
                                        Adicionar parada
                                    </button>
                                    <span className="caption">
                                        {waypoints.fields.length}/{MAX_WAYPOINTS}
                                    </span>
                                    {waypoints.fields.length >= MAX_WAYPOINTS && (
                                        <p className="field-help">
                                            Limite de {MAX_WAYPOINTS} paradas atingido.
                                        </p>
                                    )}
                                </div>
                            </li>
                            <RouteStep kind="dropoff" label="E" placed={placed.has("dropoff")} last>
                                <PointFields {...pickProps("dropoff")} label="Entrega" />
                            </RouteStep>
                        </ol>
                    </Glass>

                    <Glass as="section" className="no-section">
                        <div className="no-section-head">
                            <h2>Itens da carga</h2>
                            <span className="micro">
                                {items.fields.length}/{MAX_ITEMS}
                            </span>
                        </div>
                        {items.fields.length > 0 && (
                            <div className="no-items">
                                {items.fields.map((field, index) => {
                                    const err = formState.errors.items?.[index];
                                    return (
                                        <div key={field.id} className="item-row">
                                            <div className="field">
                                                <input
                                                    aria-label={`Nome do item ${index + 1}`}
                                                    placeholder="Nome do item"
                                                    aria-invalid={!!err?.name}
                                                    {...register(
                                                        `items.${index}.name`,
                                                        requiredText("Informe o nome do item"),
                                                    )}
                                                />
                                                {err?.name && (
                                                    <p className="field-error">
                                                        {err.name.message}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="field">
                                                <input
                                                    type="number"
                                                    aria-label={`Quantidade do item ${index + 1}`}
                                                    aria-invalid={!!err?.quantity}
                                                    {...register(`items.${index}.quantity`, {
                                                        valueAsNumber: true,
                                                        validate: (v) =>
                                                            (Number.isInteger(v) && v >= 1) ||
                                                            "Quantidade mínima: 1",
                                                    })}
                                                />
                                                {err?.quantity && (
                                                    <p className="field-error">
                                                        {err.quantity.message}
                                                    </p>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                className="btn btn-ghost btn-icon"
                                                aria-label={`Remover item ${index + 1}`}
                                                onClick={() => items.remove(index)}
                                            >
                                                <Trash2 size={16} aria-hidden="true" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        <button
                            type="button"
                            className="btn btn-secondary btn-sm add-row"
                            disabled={items.fields.length >= MAX_ITEMS}
                            onClick={() => items.append({ name: "", quantity: 1 })}
                        >
                            <Plus size={16} aria-hidden="true" />
                            Adicionar item
                        </button>
                    </Glass>

                    <Glass as="section" className="no-section">
                        <h2>Opções</h2>
                        <label className="filter-toggle no-pod">
                            <input type="checkbox" className="check" {...register("podRequired")} />
                            Exigir prova de entrega
                        </label>
                        <div className="field">
                            <label htmlFor="notes">Observações</label>
                            <textarea
                                id="notes"
                                rows={3}
                                aria-invalid={!!formState.errors.notes}
                                {...register("notes", {
                                    maxLength: {
                                        value: 500,
                                        message: "No máximo 500 caracteres",
                                    },
                                })}
                            />
                            <div className="notes-foot">
                                {formState.errors.notes ? (
                                    <p className="field-error">{formState.errors.notes.message}</p>
                                ) : (
                                    <span />
                                )}
                                <span className="caption">{notesLength}/500</span>
                            </div>
                        </div>
                    </Glass>
                </div>

                <aside
                    ref={preview}
                    className={`no-preview${showMap ? " is-open" : ""}`}
                    aria-label="Pré-visualização"
                >
                    <div className="no-preview-head">
                        <span className="micro">Pré-visualização</span>
                        <button
                            type="button"
                            className="btn btn-ghost btn-sm no-preview-toggle"
                            aria-expanded={showMap}
                            onClick={() => setPreviewOpen((open) => !open)}
                        >
                            {showMap ? "Ocultar mapa" : "Mostrar mapa"}
                            <ChevronDown size={14} aria-hidden="true" />
                        </button>
                    </div>
                    {showMap && (
                        <GlassMapFrame
                            markers={markers}
                            line
                            onPick={picking ? handlePick : undefined}
                            pickHint={
                                picking
                                    ? `Clique no mapa para definir latitude e longitude: ${pickLabel}`
                                    : undefined
                            }
                        />
                    )}
                    <p className="field-help">
                        {markers.length === 0
                            ? "Os pontos com latitude e longitude aparecem aqui."
                            : "Retirada (R), paradas numeradas e entrega (E)."}
                    </p>
                </aside>

                <div className="form-actions">
                    <Link className="btn btn-secondary" to="/orders">
                        Cancelar
                    </Link>
                    <button type="submit" className="btn btn-primary" disabled={create.isPending}>
                        {create.isPending && (
                            <Loader2 size={16} className="spin" aria-hidden="true" />
                        )}
                        Criar pedido
                    </button>
                </div>
            </form>
        </FormProvider>
    );
}
