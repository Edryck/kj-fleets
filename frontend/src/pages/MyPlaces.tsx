import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { messageFor } from "../api/errors";
import { ApiError, request } from "../api/http";
import type { Page, Place, PlaceBody } from "../api/types";
import DataTable, { type Column } from "../components/DataTable";
import MapView from "../components/MapView";
import { ConfirmDialog, Drawer } from "../components/overlays";
import { toast } from "../components/Toasts";

interface FormValues {
    name: string;
    address: string;
    lat: string;
    lng: string;
}

const toNumber = (v: string) => Number(v.replace(",", "."));
const coord = (min: number, max: number, empty: string, invalid: string) => ({
    validate: (v: string) => {
        if (v.trim() === "") return empty;
        const n = toNumber(v);
        return (Number.isFinite(n) && n >= min && n <= max) || invalid;
    },
});

function PlaceDrawer({ place, onClose }: { place: Place | null; onClose: () => void }) {
    const client = useQueryClient();
    const form = useForm<FormValues>({
        defaultValues: {
            name: place?.name ?? "",
            address: place?.address ?? "",
            lat: place?.lat == null ? "" : String(place.lat),
            lng: place?.lng == null ? "" : String(place.lng),
        },
    });
    const { register, handleSubmit, watch, setValue, setError, formState } = form;
    const [lat, lng] = [watch("lat"), watch("lng")];
    const latN = toNumber(lat);
    const lngN = toNumber(lng);
    const hasPoint =
        lat.trim() !== "" && lng.trim() !== "" && Math.abs(latN) <= 90 && Math.abs(lngN) <= 180;

    const save = useMutation({
        mutationFn: (body: PlaceBody) =>
            place
                ? request<Place>("PUT", `/customer/places/${place.publicId}`, body)
                : request<Place>("POST", "/customer/places", body),
        onSuccess: () => {
            toast.success(place ? "Endereço atualizado." : "Endereço salvo.");
            void client.invalidateQueries({ queryKey: ["/customer/places"] });
            onClose();
        },
        // 409 RESOURCE_IN_USE (endereço em pedido ativo) usa a mensagem da API
        onError: (e: ApiError) => setError("root", { message: messageFor(e.code, e.message) }),
    });

    return (
        <Drawer
            title={place ? "Editar endereço" : "Novo endereço"}
            onClose={onClose}
            footer={
                <>
                    <button type="button" className="btn btn-secondary" onClick={onClose}>
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        form="place-form"
                        className="btn btn-primary"
                        disabled={save.isPending}
                    >
                        {save.isPending && (
                            <Loader2 size={16} className="spin" aria-hidden="true" />
                        )}
                        Salvar endereço
                    </button>
                </>
            }
        >
            <form
                id="place-form"
                className="stack"
                noValidate
                onSubmit={handleSubmit((v) =>
                    save.mutate({
                        name: v.name.trim(),
                        address: v.address.trim(),
                        lat: toNumber(v.lat),
                        lng: toNumber(v.lng),
                    }),
                )}
            >
                {formState.errors.root && (
                    <p className="notice notice-danger" role="alert">
                        {formState.errors.root.message}
                    </p>
                )}
                <div className="field">
                    <label htmlFor="place-name">Nome</label>
                    <input
                        id="place-name"
                        placeholder="Ex.: Casa, Loja centro"
                        aria-invalid={!!formState.errors.name}
                        {...register("name", {
                            validate: (v) => v.trim() !== "" || "Informe o nome",
                        })}
                    />
                    {formState.errors.name && (
                        <p className="field-error">{formState.errors.name.message}</p>
                    )}
                </div>
                <div className="field">
                    <label htmlFor="place-address">Endereço</label>
                    <input
                        id="place-address"
                        aria-invalid={!!formState.errors.address}
                        {...register("address", {
                            validate: (v) => v.trim() !== "" || "Informe o endereço",
                        })}
                    />
                    {formState.errors.address && (
                        <p className="field-error">{formState.errors.address.message}</p>
                    )}
                </div>
                <p className="field-help">
                    Clique no mapa para marcar o ponto. A latitude e a longitude são preenchidas por
                    ele.
                </p>
                <MapView
                    markers={
                        hasPoint
                            ? [
                                  {
                                      id: "place",
                                      kind: "pickup",
                                      lat: latN,
                                      lng: lngN,
                                      title: "Ponto",
                                  },
                              ]
                            : []
                    }
                    onPick={(a, b) => {
                        setValue("lat", a.toFixed(6), { shouldValidate: true });
                        setValue("lng", b.toFixed(6), { shouldValidate: true });
                    }}
                    pickHint="Clique no mapa para marcar o ponto"
                />
                <div className="point-grid">
                    <div className="field">
                        <label htmlFor="place-lat">Latitude</label>
                        <input
                            id="place-lat"
                            inputMode="decimal"
                            className="data"
                            aria-invalid={!!formState.errors.lat}
                            {...register(
                                "lat",
                                coord(-90, 90, "Marque o ponto no mapa", "Latitude entre -90 e 90"),
                            )}
                        />
                        {formState.errors.lat && (
                            <p className="field-error">{formState.errors.lat.message}</p>
                        )}
                    </div>
                    <div className="field">
                        <label htmlFor="place-lng">Longitude</label>
                        <input
                            id="place-lng"
                            inputMode="decimal"
                            className="data"
                            aria-invalid={!!formState.errors.lng}
                            {...register(
                                "lng",
                                coord(
                                    -180,
                                    180,
                                    "Marque o ponto no mapa",
                                    "Longitude entre -180 e 180",
                                ),
                            )}
                        />
                        {formState.errors.lng && (
                            <p className="field-error">{formState.errors.lng.message}</p>
                        )}
                    </div>
                </div>
            </form>
        </Drawer>
    );
}

export default function MyPlaces() {
    const client = useQueryClient();
    const [search, setSearch] = useState("");
    const [q, setQ] = useState("");
    const [limit, setLimit] = useState(20);
    const [offset, setOffset] = useState(0);
    const [editing, setEditing] = useState<Place | "new" | null>(null);
    const [removing, setRemoving] = useState<Place | null>(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            setQ(search.trim());
            setOffset(0);
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    const places = useQuery({
        queryKey: ["/customer/places", q, limit, offset],
        queryFn: () =>
            request<Page<Place>>("GET", "/customer/places", undefined, { q, limit, offset }),
        placeholderData: (previous) => previous,
    });

    const remove = useMutation({
        mutationFn: (place: Place) => request<void>("DELETE", `/customer/places/${place.publicId}`),
        onSuccess: () => {
            toast.success("Endereço removido.");
            void client.invalidateQueries({ queryKey: ["/customer/places"] });
        },
        onError: (e: ApiError) => toast.error(messageFor(e.code, e.message)),
        onSettled: () => setRemoving(null),
    });

    const add = (
        <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}>
            <Plus size={18} aria-hidden="true" />
            Novo endereço
        </button>
    );

    const columns: Column<Place>[] = [
        { header: "Nome", render: (p) => <strong>{p.name}</strong> },
        { header: "Endereço", render: (p) => p.address },
        {
            header: "Ações",
            align: "right",
            render: (p) => (
                <div className="row-actions">
                    <button
                        type="button"
                        className="btn btn-ghost btn-icon"
                        aria-label={`Editar ${p.name}`}
                        onClick={() => setEditing(p)}
                    >
                        <Pencil size={16} aria-hidden="true" />
                    </button>
                    <button
                        type="button"
                        className="btn btn-ghost btn-icon"
                        aria-label={`Remover ${p.name}`}
                        onClick={() => setRemoving(p)}
                    >
                        <Trash2 size={16} aria-hidden="true" />
                    </button>
                </div>
            ),
        },
    ];

    return (
        <div className="stack">
            <header className="page-head">
                <div>
                    <h1>Meus endereços</h1>
                    <p className="page-sub">
                        Salve os lugares que você usa e escolha-os ao criar um pedido.
                    </p>
                </div>
                {add}
            </header>

            <label className="search-field">
                <Search size={16} aria-hidden="true" />
                <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar por nome ou endereço"
                    aria-label="Buscar endereços"
                />
            </label>

            <DataTable
                columns={columns}
                rows={places.data?.items}
                rowKey={(p) => p.publicId}
                total={places.data?.total ?? 0}
                limit={limit}
                offset={offset}
                onPage={(o, l) => {
                    setOffset(o);
                    setLimit(l);
                }}
                loading={places.isLoading}
                error={
                    places.isError
                        ? messageFor(
                              (places.error as ApiError).code,
                              (places.error as ApiError).message,
                          )
                        : undefined
                }
                onRetry={() => places.refetch()}
                emptyTitle={
                    q ? "Nenhum endereço com essa busca" : "Você ainda não salvou endereços"
                }
                emptyAction={q ? undefined : add}
            />

            {editing && (
                <PlaceDrawer
                    place={editing === "new" ? null : editing}
                    onClose={() => setEditing(null)}
                />
            )}
            {removing && (
                <ConfirmDialog
                    title="Remover endereço"
                    description={`${removing.name} deixa de aparecer na sua lista. Pedidos antigos continuam intactos.`}
                    confirmLabel="Remover endereço"
                    destructive
                    busy={remove.isPending}
                    onClose={() => setRemoving(null)}
                    onConfirm={() => remove.mutate(removing)}
                />
            )}
        </div>
    );
}
