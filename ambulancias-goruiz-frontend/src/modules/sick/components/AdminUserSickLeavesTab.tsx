import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../../hooks/useAuth";
import { useTranslation } from "react-i18next";
import { toastT } from "../../../utils/toast";
import { openSecureFile } from "../../../utils/openSecureFile";
import { displayFileNameFromUrl } from "../../../utils/fileName";
import {
  adminListSickLeaves,
  type SickLeave,
} from "../domain";
import StatusBadge from "../../../components/common/StatusBadge";
import { sickLeaveTone } from "../utils/sickLeavesTone";
import { useSickLeavesChanged } from "../hooks/useSickLeavesChanged";

type Props = {
  userId: string;
};

function fmtISO(d?: string, locale?: string) {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(locale || "es");
}

export default function AdminUserSickLeavesTab({ userId }: Props) {
  const { token } = useAuth();
  const { t, i18n } = useTranslation();

  const [items, setItems] = useState<SickLeave[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDocsId, setOpenDocsId] = useState<string | null>(null);

  const load = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const data = await adminListSickLeaves({ status: undefined });
      const filtered = (data || []).filter((it) => {
        const u = it.user as any;
        const uid = typeof u === "string" ? u : u?._id;
        return uid === userId;
      });
      setItems(filtered);
    } catch (err: unknown) {
      console.error(err);
      toastT.apiError(err, ["pages.sick.admin.listError"]);
    } finally {
      setLoading(false);
    }
  };
  const loadRef = useRef(load);
  loadRef.current = load;

  // Sincronización cross-tab (CustomEvent + BroadcastChannel + storage)
  useSickLeavesChanged(() => void loadRef.current?.());

  useEffect(() => {
    load();
  }, [token, userId]);


  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white ring-1 ring-slate-200 shadow">
        {loading && (
          <div className="p-4 text-sm text-slate-600 text-center">
            {t("common.loading", "Cargando...")}
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="p-4 text-sm text-slate-600 text-center">
            {t(
              "pages.sick.admin.empty",
              "No hay bajas registradas para este trabajador",
            )}
          </div>
        )}

        {!loading && items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed text-sm">
              <colgroup>
                <col className="w-[30%]" /> {/* Fechas */}
                <col className="w-[12%]" /> {/* Días */}
                <col className="w-[18%]" /> {/* Estado */}
                <col className="w-[40%]" /> {/* Documentos */}
              </colgroup>

              <thead className="sticky top-0 bg-slate-50 z-10">
                <tr className="text-slate-600 border-b border-slate-200 text-center">
                  <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                    {t("pages.sick.admin.th.dates", "Fechas")}
                  </th>
                  <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                    {t("pages.sick.admin.th.days", "Días")}
                  </th>
                  <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                    {t("pages.sick.admin.th.status", "Estado")}
                  </th>
                  <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                    {t("pages.sick.admin.th.doc", "Documentos")}
                  </th>
                </tr>
              </thead>

              <tbody className="[&>tr:nth-child(odd)]:bg-slate-50/30">
                {items.map((it) => {
                  const rawDocUrls: string[] = [
                    ...(it.documentUrl ? [it.documentUrl] : []),
                    ...(Array.isArray(it.documents) ? it.documents : []),
                  ];
                  const seen = new Set<string>();
                  const docUrls = rawDocUrls.filter((u) => {
                    const key = (displayFileNameFromUrl(u) || u).toLowerCase();
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                  });

                  const isOpen = openDocsId === it._id;

                  const days = (() => {
                    const s = new Date(it.startDate);
                    const e = new Date(it.endDate);
                    s.setHours(0, 0, 0, 0);
                    e.setHours(0, 0, 0, 0);
                    const diff =
                      Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
                    return isNaN(diff) ? "—" : Math.max(diff, 1);
                  })();

                  return (
                    <tr
                      key={it._id}
                      className="border-b border-slate-100 hover:bg-slate-50/70 text-center"
                    >
                      <td className="px-3 py-2 align-top">
                        <div className="text-slate-800 whitespace-nowrap">
                          {fmtISO(it.startDate, i18n.language)} —{" "}
                          {fmtISO(it.endDate, i18n.language)}
                        </div>
                        {it.note && (
                          <div className="mt-0.5 text-[11px] text-slate-500 truncate">
                            {it.note}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">{days}</td>
                      <td className="px-3 py-2 align-top whitespace-nowrap">
                        <StatusBadge
                          tone={sickLeaveTone(it.status)}
                          label={t(`pages.sick.status.${it.status}`, it.status)}
                        />

                      </td>
                      <td className="px-3 py-2 align-top">
                        {docUrls.length === 0 ? (
                          <span className="text-slate-500">
                            {t("pages.sick.docs.none", "Sin documento")}
                          </span>
                        ) : (
                          <div className="inline-block text-center">
                            <button
                              type="button"
                              onClick={() =>
                                setOpenDocsId(isOpen ? null : it._id)
                              }
                              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-blue-100"
                              aria-expanded={isOpen}
                              aria-controls={`docs-panel-${it._id}`}
                            >
                              <span className="whitespace-nowrap">
                                {t(
                                  "pages.sick.docs.count",
                                  "{{n}} documentos",
                                  { n: docUrls.length },
                                )}
                              </span>
                            </button>

                            <div
                              id={`docs-panel-${it._id}`}
                              className={`overflow-hidden transition-all duration-200 ease-out mt-2 ${isOpen
                                ? "opacity-100 max-h-56"
                                : "opacity-0 max-h-0"
                                }`}
                            >
                              <ul className="flex flex-wrap justify-center gap-2">
                                {docUrls.map((url, idx) => {
                                  const label = displayFileNameFromUrl(url);
                                  return (
                                    <li
                                      key={url + idx}
                                      className="inline-flex items-center max-w-full rounded-full border border-slate-300 bg-slate-50 px-2 py-1 text-[11px]"
                                      title={label}
                                    >
                                      <span aria-hidden="true" className="mr-1">
                                        📎
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => openSecureFile(url)}
                                        className="truncate max-w-[180px] text-slate-700 hover:text-slate-900 text-left"
                                      >
                                        {label}
                                      </button>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}


