import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { messageFor } from "../api/errors";
import { ApiError, request } from "../api/http";
import type { Page, Place } from "../api/types";
import { useSession } from "../auth/session";
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
    contactName: string;
    contactPhone: string;
    contactEmail: string;
}

interface PlaceBody {
    name: string;
    address: string | null;
    lat: number;
    lng: number;
    contact: { name: string; phone: string | null; email: string | null } | null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function PlaceForm({
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
            contactName: place?.contact?.name ?? "",
            contactPhone: place?.contact?.phone ?? "",
            contactEmail: place?.contact?.email ?? "",
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
                ? request<Place>("PUT", `/places/${place.publicId}`, body)
                : request<Place>("POST", "/places", body),
        onSuccess: () => {
            toast.success(place ? "Lugar atualizado." : "Lugar cadastrado.");
            void client.invalidateQueries({ queryKey: ["places"] });
            onClose();
        },
        onError: (e: ApiError) => setError("root", { message: messageFor(e.code, e.message) }),
    });

    return (
        <SidePanel
            title={place ? "Editar lugar" : "Novo lugar"}
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
                        {place ? "Salvar lugar" : "Cadastrar lugar"}
                    </button>
                </>
            }
        >
            <form
                id="place-form"
                className="stack"
                noValidate
                onSubmit={handleSubmit((v) => {
                    const contactName = v.contactName.trim();
                    const phone = v.contactPhone.trim();
                    const email = v.contactEmail.trim();
                    save.mutate({
                        name: v.name.trim(),
                        address: v.address.trim() || null,
                        lat: toNumber(v.lat),
                        lng: toNumber(v.lng),
                        contact:
                            contactName || phone || email
                                ? {
                                      name: contactName,
                                      phone: phone || null,
                                      email: email || null,
                                  }
                                : null,
                    });
                })}
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
                        placeholder="Ex.: Depósito norte"
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
                    <input id="place-address" {...register("address")} />
                    <p className="field-help">Opcional. Ajuda a reconhecer o lugar na lista.</p>
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
                    markerKind="waypoint"
                />
                <fieldset className="field-group">
                    <legend>Contato (opcional)</legend>
                    <div className="field">
                        <label htmlFor="place-contact-name">Nome do contato</label>
                        <input
                            id="place-contact-name"
                            aria-invalid={!!formState.errors.contactName}
                            {...register("contactName", {
                                validate: (v, values) =>
                                    v.trim() !== "" ||
                                    (!values.contactPhone.trim() && !values.contactEmail.trim()) ||
                                    "Informe o nome do contato",
                            })}
                        />
                        {formState.errors.contactName && (
                            <p className="field-error">{formState.errors.contactName.message}</p>
                        )}
                    </div>
                    <div className="field-row">
                        <div className="field">
                            <label htmlFor="place-contact-phone">Telefone</label>
                            <input
                                id="place-contact-phone"
                                inputMode="tel"
                                {...register("contactPhone")}
                            />
                        </div>
                        <div className="field">
                            <label htmlFor="place-contact-email">E-mail</label>
                            <input
                                id="place-contact-email"
                                inputMode="email"
                                aria-invalid={!!formState.errors.contactEmail}
                                {...register("contactEmail", {
                                    validate: (v) =>
                                        !v.trim() || EMAIL.test(v.trim()) || "E-mail inválido",
                                })}
                            />
                            {formState.errors.contactEmail && (
                                <p className="field-error">
                                    {formState.errors.contactEmail.message}
                                </p>
                            )}
                        </div>
                    </div>
                </fieldset>
            </form>
        </SidePanel>
    );
}

type Panel = { mode: "edit"; id: string } | { mode: "new" } | null;

export default function Places() {
    const client = useQueryClient();
    const session = useSession();
    const canWrite = session?.role === "ADMIN" || session?.role === "DISPATCHER";
    const narrow = useMediaQuery("(max-width: 1023px)");
    const [q, setQ] = useState("");
    const [includeInactive, setIncludeInactive] = useState(false);
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
        queryKey: ["places", q, includeInactive, limit, offset],
        queryFn: () =>
            request<Page<Place>>("GET", "/places", undefined, {
                q,
                includeInactive: includeInactive || undefined,
                limit,
                offset,
            }),
        placeholderData: (previous) => previous,
    });

    const toggle = useMutation({
        mutationFn: ({
            place,
            action,
        }: {
            place: Place;
            action: "reactivate" | "delete";
        }): Promise<unknown> =>
            action === "delete"
                ? request<void>("DELETE", `/places/${place.publicId}`)
                : request<Place>("POST", `/places/${place.publicId}/reactivate`),
        onSuccess: (_, { action }) => {
            toast.success(action === "delete" ? "Lugar removido." : "Lugar reativado.");
            void client.invalidateQueries({ queryKey: ["places"] });
        },
        onError: (e: ApiError) => toast.error(messageFor(e.code, e.message)),
        onSettled: () => setRemoving(null),
    });

    const openPanel = (next: Panel) => {
        setPicked(null);
        setPanel(next);
    };

    const add = canWrite ? (
        <button
            type="button"
            className="btn btn-primary"
            onClick={() => openPanel({ mode: "new" })}
        >
            <Plus size={18} aria-hidden="true" />
            Novo lugar
        </button>
    ) : undefined;

    useTitleBlock({ title: "Lugares", actions: add });

    const items = places.data?.items;
    const editing = panel?.mode === "edit" ? items?.find((p) => p.publicId === panel.id) : null;
    const closePanel = () => setPanel(null);

    let panelNode: ReactNode = null;
    if (panel?.mode === "new" || editing) {
        panelNode = (
            <PlaceForm
                key={editing?.publicId ?? "new"}
                place={editing ?? null}
                onClose={closePanel}
                picked={picked}
                onDraft={setDraft}
                inline={narrow}
            />
        );
    }

    const renderActions = canWrite
        ? (p: Place) =>
              p.active ? (
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
                          aria-label={`Excluir ${p.name}`}
                          onClick={() => setRemoving(p)}
                      >
                          <Trash2 size={14} aria-hidden="true" />
                          Excluir
                      </button>
                  </>
              ) : (
                  <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={toggle.isPending}
                      onClick={() => toggle.mutate({ place: p, action: "reactivate" })}
                  >
                      <RotateCcw size={14} aria-hidden="true" />
                      Reativar
                  </button>
              )
        : undefined;

    const total = places.data?.total;
    const heroLabel = q
        ? total === 1
            ? "lugar encontrado"
            : "lugares encontrados"
        : includeInactive
          ? "lugares, com inativos"
          : total === 1
            ? "lugar ativo"
            : "lugares ativos";

    return (
        <SidePanelLayout open={panelNode != null} panel={panelNode}>
            <PlaceAtlas
                heroLabel={heroLabel}
                total={total}
                searchLabel="Buscar lugares"
                onQuery={changeQuery}
                filters={
                    canWrite && (
                        <label className="filter-toggle">
                            <input
                                type="checkbox"
                                className="check"
                                checked={includeInactive}
                                onChange={(e) => {
                                    setIncludeInactive(e.target.checked);
                                    setOffset(0);
                                }}
                            />
                            Mostrar inativos
                        </label>
                    )
                }
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
                emptyTitle={q ? "Nenhum lugar com essa busca" : "Nenhum lugar cadastrado"}
                emptyAction={!q ? add : undefined}
                selectedId={selectedId}
                onSelect={setSelectedId}
                renderMeta={(p) =>
                    p.contact ? (
                        <small className="atlas-contact">
                            {p.contact.name}
                            {(p.contact.phone ?? p.contact.email) &&
                                ` · ${p.contact.phone ?? p.contact.email}`}
                        </small>
                    ) : null
                }
                renderActions={renderActions}
                limit={limit}
                offset={offset}
                onPage={(o, l) => {
                    setOffset(o);
                    setLimit(l);
                }}
                markerKind="waypoint"
                draft={draft}
                editingId={editing?.publicId ?? null}
                picking={panelNode != null && !narrow}
                onPick={(lat, lng) => setPicked({ lat, lng, at: Date.now() })}
            />
            {removing && (
                <ConfirmDialog
                    title="Excluir lugar"
                    description={`${removing.name} sai da lista ativa e dos seletores de pedido. Pedidos já criados continuam com este lugar.`}
                    confirmLabel="Excluir lugar"
                    destructive
                    busy={toggle.isPending}
                    onClose={() => setRemoving(null)}
                    onConfirm={() => toggle.mutate({ place: removing, action: "delete" })}
                />
            )}
        </SidePanelLayout>
    );
}
