import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { messageFor } from "../api/errors";
import { ApiError, request } from "../api/http";
import type { Page, Place, PlaceBody } from "../api/types";
import { ConfirmDialog } from "../components/overlays";
import { toast } from "../components/Toasts";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useTitleBlock } from "../layout/titleBlockContext";
import { SidePanel, SidePanelLayout } from "../patterns/SidePanel";
import {
    PlaceAtlas,
    PointFields,
    coord,
    toNumber,
    type PickedPoint,
    type Point,
} from "./places/placeAtlas";

interface FormValues {
    name: string;
    address: string;
    lat: string;
    lng: string;
}

function AddressForm({
    place,
    onClose,
    picked,
    onDraft,
    inline,
}: {
    place: Place | null;
    onClose: () => void;
    picked: PickedPoint | null;
    onDraft: (point: Point | null) => void;
    inline: boolean;
}) {
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
    const setPoint = useCallback(
        (a: number, b: number) => {
            setValue("lat", a.toFixed(6), { shouldValidate: true });
            setValue("lng", b.toFixed(6), { shouldValidate: true });
        },
        [setValue],
    );

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
        onError: (e: ApiError) => setError("root", { message: messageFor(e.code, e.message) }),
    });

    return (
        <SidePanel
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
                <PointFields
                    lat={register(
                        "lat",
                        coord(-90, 90, "Marque o ponto no mapa", "Latitude entre -90 e 90"),
                    )}
                    lng={register(
                        "lng",
                        coord(-180, 180, "Marque o ponto no mapa", "Longitude entre -180 e 180"),
                    )}
                    latText={watch("lat")}
                    lngText={watch("lng")}
                    latError={formState.errors.lat?.message}
                    lngError={formState.errors.lng?.message}
                    setPoint={setPoint}
                    picked={picked}
                    onDraft={onDraft}
                    inline={inline}
                    markerKind="pickup"
                />
            </form>
        </SidePanel>
    );
}

type Panel = { mode: "edit"; id: string } | { mode: "new" } | null;

export default function MyPlaces() {
    const client = useQueryClient();
    const narrow = useMediaQuery("(max-width: 1023px)");
    const [q, setQ] = useState("");
    const [limit, setLimit] = useState(20);
    const [offset, setOffset] = useState(0);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [panel, setPanel] = useState<Panel>(null);
    const [picked, setPicked] = useState<PickedPoint | null>(null);
    const [draft, setDraft] = useState<Point | null>(null);
    const [removing, setRemoving] = useState<Place | null>(null);

    const changeQuery = useCallback((value: string) => {
        setQ(value);
        setOffset(0);
    }, []);

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

    const openPanel = (next: Panel) => {
        setPicked(null);
        setPanel(next);
    };

    const add = (
        <button
            type="button"
            className="btn btn-primary"
            onClick={() => openPanel({ mode: "new" })}
        >
            <Plus size={18} aria-hidden="true" />
            Novo endereço
        </button>
    );

    useTitleBlock({ title: "Meus endereços", actions: add });

    const items = places.data?.items;
    const editing = panel?.mode === "edit" ? items?.find((p) => p.publicId === panel.id) : null;
    const closePanel = () => setPanel(null);

    let panelNode: ReactNode = null;
    if (panel?.mode === "new" || editing) {
        panelNode = (
            <AddressForm
                key={editing?.publicId ?? "new"}
                place={editing ?? null}
                onClose={closePanel}
                picked={picked}
                onDraft={setDraft}
                inline={narrow}
            />
        );
    }

    const total = places.data?.total;
    const heroLabel = q
        ? total === 1
            ? "endereço encontrado"
            : "endereços encontrados"
        : total === 1
          ? "endereço salvo"
          : "endereços salvos";

    return (
        <SidePanelLayout open={panelNode != null} panel={panelNode}>
            <PlaceAtlas
                heroLabel={heroLabel}
                total={total}
                searchLabel="Buscar endereços"
                onQuery={changeQuery}
                items={items}
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
                selectedId={selectedId}
                onSelect={setSelectedId}
                renderActions={(p) => (
                    <>
                        <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            aria-label={`Editar ${p.name}`}
                            onClick={() => openPanel({ mode: "edit", id: p.publicId })}
                        >
                            <Pencil size={14} aria-hidden="true" />
                            Editar
                        </button>
                        <button
                            type="button"
                            className="btn btn-ghost btn-sm btn-danger-ghost"
                            aria-label={`Remover ${p.name}`}
                            onClick={() => setRemoving(p)}
                        >
                            <Trash2 size={14} aria-hidden="true" />
                            Remover
                        </button>
                    </>
                )}
                limit={limit}
                offset={offset}
                onPage={(o, l) => {
                    setOffset(o);
                    setLimit(l);
                }}
                markerKind="pickup"
                draft={draft}
                editingId={editing?.publicId ?? null}
                picking={panelNode != null && !narrow}
                onPick={(lat, lng) => setPicked({ lat, lng, at: Date.now() })}
            />
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
        </SidePanelLayout>
    );
}
