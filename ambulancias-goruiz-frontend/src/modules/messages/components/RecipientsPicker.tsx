// src/modules/messages/components/RecipientsPicker.tsx
import { useMemo, useRef } from "react";
import type { User } from "../../../types/user";
import { useTranslation } from "react-i18next";
import DeleteIconButton from "../../../components/common/actions/DeleteIconButton";

type Props = {
    users: User[];

    search: string;
    setSearch: (v: string) => void;

    selectedIds: string[];
    setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;

    sendToAll: boolean;
    setSendToAll: React.Dispatch<React.SetStateAction<boolean>>;

    // Opcional: limita resultados para no renderizar 200+ items
    maxResults?: number;
};

const RecipientsPicker = ({
    users,
    search,
    setSearch,
    selectedIds,
    setSelectedIds,
    sendToAll,
    setSendToAll,
    maxResults = 12,
}: Props) => {
    const { t } = useTranslation();

    const searchInputRef = useRef<HTMLInputElement | null>(null);


    const usersById = useMemo(() => {
        const map = new Map<string, User>();
        users.forEach((u) => map.set(u._id, u));
        return map;
    }, [users]);

    const selectedUsers = useMemo(() => {
        // Mantiene el orden de selectedIds
        return selectedIds.map((id) => usersById.get(id)).filter(Boolean) as User[];
    }, [selectedIds, usersById]);

    const term = useMemo(() => search.trim().toLowerCase(), [search]);

    const filteredMeta = useMemo(() => {
        // ✅ Si no hay búsqueda, no devolvemos resultados (mejor para 200+)
        if (!term) {
            return {
                totalMatches: 0,
                limited: [] as User[],
                hasMore: false,
            };
        }

        const matches = users.filter((u) =>
            `${u.lastName} ${u.name}`.toLowerCase().includes(term),
        );

        return {
            totalMatches: matches.length,
            limited: matches.slice(0, maxResults),
            hasMore: matches.length > maxResults,
        };
    }, [users, term, maxResults]);


    const totalSelected = sendToAll ? users.length : selectedIds.length;

    const toggleUser = (id: string) => {
        setSelectedIds((prev) => {
            const wasSelected = prev.includes(id);
            const next = wasSelected ? prev.filter((x) => x !== id) : [...prev, id];

            if (!wasSelected) {
                setSearch("");

                // ✅ mantenemos el foco en el input
                requestAnimationFrame(() => {
                    searchInputRef.current?.focus();
                });
            }

            return next;
        });
    };



    const removeSelected = (id: string) => {
        setSelectedIds((prev) => prev.filter((x) => x !== id));
    };

    return (
        <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
                {t("pages.messages.adminPage.labels.recipients")}
            </label>

            {/* Fila superior: buscador izquierda / enviar a todos derecha */}
            <div className="flex items-center gap-3">
                <div className="flex-1">
                    <div className="relative">
                        {/* Icono lupa: solo cuando no hay texto */}
                        {!search && (
                            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                                🔍
                            </span>
                        )}

                        <input
                            ref={searchInputRef}
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className={`
      w-full rounded-lg border border-slate-200
      ${search ? "pl-3" : "pl-8"} pr-3 py-2
      text-xs shadow-sm
      focus:outline-none focus:ring-2 focus:ring-blue-100
      disabled:bg-slate-50 disabled:text-slate-400
    `}
                            disabled={sendToAll}
                            aria-label={t(
                                "pages.messages.adminPage.searchAriaLabel",
                                "Buscar trabajador",
                            ) as string}
                        />
                    </div>


                </div>

                <label className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
                    <input
                        type="checkbox"
                        checked={sendToAll}
                        onChange={() => setSendToAll(!sendToAll)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-200"
                    />

                    <span className="text-xs text-slate-700 whitespace-nowrap">
                        {t("pages.messages.adminPage.sendToAll")}
                    </span>

                    {/* contador SOLO número */}
                    <span className="ml-1 rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                        {totalSelected}
                    </span>
                </label>

            </div>


            {/* Chips + resultados (solo si NO es sendToAll) */}
            {!sendToAll && (
                <div className="space-y-2">
                    {/* Chips de seleccionados */}
                    {selectedUsers.length > 0 && (
                        <div className="flex flex-wrap gap-2 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
                            {selectedUsers.map((u) => (
                                <span
                                    key={u._id}
                                    className="inline-flex items-center gap-2 rounded-full bg-white px-2.5 py-1 text-xs text-slate-700 ring-1 ring-slate-200"
                                    title={`${u.lastName}, ${u.name}`}
                                >
                                    <span className="max-w-[180px] truncate">
                                        {u.lastName}, {u.name}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => removeSelected(u._id)}
                                        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                                        aria-label={t("common.remove", "Quitar") as string}
                                        title={t("common.remove", "Quitar") as string}
                                    >
                                        ×
                                    </button>
                                </span>
                            ))}

                            {/* Limpieza rápida */}
                            <DeleteIconButton
                                onClick={() => setSelectedIds([])}
                                title={t("common.clear", "Limpiar") as string}
                                className="ml-auto"
                            />

                        </div>
                    )}

                    {/* Resultados limitados (solo si hay búsqueda) */}
                    {!!term && (
                        <div className="rounded-xl ring-1 ring-slate-200 bg-slate-50/60">
                            {filteredMeta.limited.length === 0 ? (
                                <p className="px-3 py-3 text-[11px] text-slate-500">
                                    {t(
                                        "pages.messages.adminPage.noWorkersFound",
                                        "No se han encontrado trabajadores.",
                                    )}
                                </p>
                            ) : (
                                <>
                                    <ul className="divide-y divide-slate-200">
                                        {filteredMeta.limited.map((user) => (
                                            <li key={user._id} className="px-3 py-1.5">
                                                <label className="flex items-center gap-2 text-xs text-slate-700">
                                                    <input
                                                        type="checkbox"
                                                        value={user._id}
                                                        checked={selectedIds.includes(user._id)}
                                                        onChange={() => toggleUser(user._id)}
                                                        className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-200"
                                                    />
                                                    <span className="truncate">
                                                        {user.lastName}, {user.name}
                                                    </span>
                                                </label>
                                            </li>
                                        ))}
                                    </ul>

                                    {/* Footer eliminado intencionadamente */}

                                </>
                            )}
                        </div>
                    )}

                </div>
            )}
        </div>
    );

};

export default RecipientsPicker;
