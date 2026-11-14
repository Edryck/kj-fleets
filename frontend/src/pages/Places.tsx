import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { messageFor } from "../api/errors";
import { ApiError, request } from "../api/http";
import type { Page, Place } from "../api/types";
import { useSession } from "../auth/session";
import DataTable, { type Column } from "../components/DataTable";
import MapView from "../components/MapView";
import { ConfirmDialog, Drawer } from "../components/overlays";
import { toast } from "../components/Toasts";

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

const toNumber = (v: string) => Number(v.replace(",", "."));
const coord = (min: number, max: number, empty: string, invalid: string) => ({
    validate: (v: string) => {
        if (v.trim() === "") return empty;
        const n = toNumber(v);
        return (Number.isFinite(n) && n >= min && n <= max) || invalid;
    },
});
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function PlaceDrawer({ place, onClose }: { place: Place | null; onClose: () => void }) {
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
    const [lat, lng] = [watch("lat"), watch("lng")];
    const latN = toNumber(lat);
    const lngN = toNumber(lng);
    const hasPoint =
        lat.trim() !== "" && lng.trim() !== "" && Math.abs(latN) <= 90 && Math.abs(lngN) <= 180;

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
        <Drawer
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
                                      kind: "waypoint",
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
        </Drawer>
    );
}

export default function Places() {
    const client = useQueryClient();
    const session = useSession();
    const canWrite = session?.role === "ADMIN" || session?.role === "DISPATCHER";
    // o backend só aceita includeInactive para ADMIN e DISPATCHER
    const [search, setSearch] = useState("");
    const [q, setQ] = useState("");
    const [includeInactive, setIncludeInactive] = useState(false);
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

    const add = canWrite ? (
        <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}>
            <Plus size={18} aria-hidden="true" />
            Novo lugar
        </button>
    ) : null;

    const columns: Column<Place>[] = [
        {
            header: "Nome",
            render: (p) => (
                <div className="route-cell">
                    <strong>{p.name}</strong>
                    {!p.active && <span className="badge badge-neutral">Inativo</span>}
                </div>
            ),
        },
        { header: "Endereço", render: (p) => p.address || "—" },
        {
            header: "Coordenadas",
            render: (p) =>
                p.lat == null || p.lng == null ? (
                    "—"
                ) : (
                    <span className="data">
                        {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                    </span>
                ),
        },
        {
            header: "Contato",
            render: (p) =>
                p.contact ? (
                    <div className="route-cell">
                        <span>{p.contact.name}</span>
                        <span className="caption">{p.contact.phone ?? p.contact.email ?? ""}</span>
                    </div>
                ) : (
                    "—"
                ),
        },
        ...(canWrite
            ? [
                  {
                      header: "Ações",
                      align: "right" as const,
                      render: (p: Place) => (
                          <div className="row-actions">
                              {p.active ? (
                                  <>
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
                                          aria-label={`Excluir ${p.name}`}
                                          onClick={() => setRemoving(p)}
                                      >
                                          <Trash2 size={16} aria-hidden="true" />
                                      </button>
                                  </>
                              ) : (
                                  <button
                                      type="button"
                                      className="btn btn-ghost btn-sm"
                                      disabled={toggle.isPending}
                                      onClick={() =>
                                          toggle.mutate({ place: p, action: "reactivate" })
                                      }
                                  >
                                      <RotateCcw size={14} aria-hidden="true" />
                                      Reativar
                                  </button>
                              )}
                          </div>
                      ),
                  },
              ]
            : []),
    ];

    const mapped = (places.data?.items ?? []).filter((p) => p.lat != null && p.lng != null);

    return (
        <div className="stack">
            <header className="page-head">
                <div>
                    <h1>Lugares</h1>
                    <p className="page-sub">
                        Endereços usados como retirada e entrega nos pedidos da equipe.
                    </p>
                </div>
                {add}
            </header>

            <section className="filters" aria-label="Filtros">
                <div className="filters-row">
                    <label className="search-field">
                        <Search size={16} aria-hidden="true" />
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar por nome ou endereço"
                            aria-label="Buscar lugares"
                        />
                    </label>
                    {canWrite && (
                        <label className="inline-field">
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
                    )}
                </div>
            </section>

            {mapped.length > 0 && (
                <MapView
                    markers={mapped.map((p) => ({
                        id: p.publicId,
                        kind: "waypoint",
                        lat: p.lat!,
                        lng: p.lng!,
                        title: p.name,
                        dimmed: !p.active,
                    }))}
                />
            )}

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
                emptyTitle={q ? "Nenhum lugar com essa busca" : "Nenhum lugar cadastrado"}
                emptyAction={!q ? add : undefined}
            />

            {editing && (
                <PlaceDrawer
                    place={editing === "new" ? null : editing}
                    onClose={() => setEditing(null)}
                />
            )}
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
        </div>
    );
}
