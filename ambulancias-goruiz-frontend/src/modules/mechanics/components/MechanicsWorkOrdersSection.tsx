import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../../hooks/useAuth";
import { useModules } from "../../../hooks/useModules";
import { MODULE_KEYS } from "../../../constants/modules";
import { getAllAmbulances } from "../../ambulances/domain/api";
import type { Ambulance } from "../../ambulances/domain/types";
import type { AppRole } from "../../users/domain/types";
import type { MechanicsWorkOrder } from "../domain/types";
import {
  listMechanicsWorkOrders,
  createMechanicsWorkOrder,
  patchMechanicsWorkOrder,
} from "../domain/api";
import { toastT, getApiErrorMessage } from "../../../utils/toast";

interface Props {
  userRole: AppRole | string | null;
}

function statusTone(
  status: MechanicsWorkOrder["status"],
): "slate" | "amber" | "emerald" | "rose" {
  if (status === "completed") return "emerald";
  if (status === "in_progress") return "amber";
  if (status === "cancelled") return "rose";
  return "slate";
}

export default function MechanicsWorkOrdersSection({ userRole }: Props) {
  const { t } = useTranslation();
  const { token } = useAuth();
  const { hasModule } = useModules();
  const ambulancesModuleOn = hasModule(MODULE_KEYS.AMBULANCES);

  const canPlan =
    userRole === "admin" || userRole === "jefe_mecanicos";
  const isMechanic = userRole === "mecanico";

  const [orders, setOrders] = useState<MechanicsWorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [ambulances, setAmbulances] = useState<Ambulance[]>([]);
  const [filterAmbulanceId, setFilterAmbulanceId] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [createAmbulanceId, setCreateAmbulanceId] = useState("");
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createPlanned, setCreatePlanned] = useState("");
  const [createAssignedTo, setCreateAssignedTo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [completeNotesById, setCompleteNotesById] = useState<
    Record<string, string>
  >({});
  const [openCompleteId, setOpenCompleteId] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const list = await listMechanicsWorkOrders(
        filterAmbulanceId.trim() || undefined,
      );
      setOrders(list);
    } catch (err: unknown) {
      toastT.error(
        getApiErrorMessage(
          err,
          t("pages.mechanics.workOrders.loadError") as string,
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [token, filterAmbulanceId, t]);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    if (!ambulancesModuleOn && filterAmbulanceId) {
      setFilterAmbulanceId("");
    }
  }, [ambulancesModuleOn, filterAmbulanceId]);

  useEffect(() => {
    if (!token || !ambulancesModuleOn) {
      setAmbulances([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const data = await getAllAmbulances();
        if (!cancelled) setAmbulances(data);
      } catch {
        if (!cancelled) setAmbulances([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, ambulancesModuleOn]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createAmbulanceId.trim() || !createTitle.trim()) {
      toastT.error(t("pages.mechanics.workOrders.createValidation") as string);
      return;
    }
    setSubmitting(true);
    try {
      await createMechanicsWorkOrder({
        ambulanceId: createAmbulanceId.trim(),
        title: createTitle.trim(),
        ...(createDescription.trim()
          ? { description: createDescription.trim() }
          : {}),
        ...(createPlanned.trim()
          ? { plannedFor: new Date(createPlanned).toISOString() }
          : {}),
        ...(createAssignedTo.trim()
          ? { assignedTo: createAssignedTo.trim() }
          : {}),
      });
      toastT.success(t("pages.mechanics.workOrders.createSuccess") as string);
      setShowCreate(false);
      setCreateAmbulanceId("");
      setCreateTitle("");
      setCreateDescription("");
      setCreatePlanned("");
      setCreateAssignedTo("");
      void fetchOrders();
    } catch (err: unknown) {
      toastT.error(
        getApiErrorMessage(
          err,
          t("pages.mechanics.workOrders.createError") as string,
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleStart = async (id: string) => {
    try {
      await patchMechanicsWorkOrder(id, { status: "in_progress" });
      toastT.success(t("pages.mechanics.workOrders.startSuccess") as string);
      void fetchOrders();
    } catch (err: unknown) {
      toastT.error(
        getApiErrorMessage(
          err,
          t("pages.mechanics.workOrders.patchError") as string,
        ),
      );
    }
  };

  const handleComplete = async (id: string) => {
    const notes = (completeNotesById[id] ?? "").trim();
    if (notes.length < 3) {
      toastT.error(t("pages.mechanics.workOrders.notesTooShort") as string);
      return;
    }
    try {
      await patchMechanicsWorkOrder(id, {
        status: "completed",
        completionNotes: notes,
      });
      toastT.success(t("pages.mechanics.workOrders.completeSuccess") as string);
      setOpenCompleteId(null);
      setCompleteNotesById((prev) => ({ ...prev, [id]: "" }));
      void fetchOrders();
    } catch (err: unknown) {
      toastT.error(
        getApiErrorMessage(
          err,
          t("pages.mechanics.workOrders.patchError") as string,
        ),
      );
    }
  };

  const handleCancelOrder = async (id: string) => {
    const ok = window.confirm(
      t("pages.mechanics.workOrders.confirmCancel") as string,
    );
    if (!ok) return;
    try {
      await patchMechanicsWorkOrder(id, { status: "cancelled" });
      toastT.success(t("pages.mechanics.workOrders.cancelSuccess") as string);
      void fetchOrders();
    } catch (err: unknown) {
      toastT.error(
        getApiErrorMessage(
          err,
          t("pages.mechanics.workOrders.patchError") as string,
        ),
      );
    }
  };

  const statusLabel = (s: MechanicsWorkOrder["status"]) =>
    t(`pages.mechanics.workOrders.status.${s}`, s);

  return (
    <div className="mt-10 border-t border-slate-200 pt-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <h2 className="text-lg font-semibold text-slate-900">
          {t("pages.mechanics.workOrders.title")}
        </h2>
        {canPlan ? (
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900"
          >
            {showCreate
              ? (t("pages.mechanics.workOrders.hideCreate") as string)
              : (t("pages.mechanics.workOrders.newOrder") as string)}
          </button>
        ) : null}
      </div>

      {ambulancesModuleOn ? (
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div>
            <label
              id="wo-filter-amb-label"
              htmlFor="wo-filter-amb"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              {t("pages.mechanics.workOrders.filterAmbulance")}
            </label>
            <select
              id="wo-filter-amb"
              aria-labelledby="wo-filter-amb-label"
              value={filterAmbulanceId}
              onChange={(e) => setFilterAmbulanceId(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 min-w-[12rem]"
            >
              <option value="">
                {t("pages.mechanics.workOrders.allAmbulances")}
              </option>
              {ambulances.map((a) => (
                <option key={a._id} value={a._id}>
                  #{a.ambulanceNumber} — {a.licensePlate}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      {showCreate && canPlan ? (
        <form
          onSubmit={handleCreate}
          className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3"
        >
          <p className="text-sm text-slate-600">
            {t("pages.mechanics.workOrders.createIntro")}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="wo-create-amb"
                className="block text-xs font-medium text-slate-600 mb-1"
              >
                {t("pages.mechanics.workOrders.fieldAmbulance")}
              </label>
              {ambulancesModuleOn && ambulances.length > 0 ? (
                <select
                  id="wo-create-amb"
                  required
                  value={createAmbulanceId}
                  onChange={(e) => setCreateAmbulanceId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  aria-label={t("pages.mechanics.workOrders.fieldAmbulance")}
                >
                  <option value="">
                    {t("pages.mechanics.workOrders.selectAmbulance")}
                  </option>
                  {ambulances.map((a) => (
                    <option key={a._id} value={a._id}>
                      #{a.ambulanceNumber} — {a.licensePlate}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="wo-create-amb"
                  required
                  value={createAmbulanceId}
                  onChange={(e) => setCreateAmbulanceId(e.target.value)}
                  placeholder={t(
                    "pages.mechanics.workOrders.ambulanceIdPlaceholder",
                  )}
                  aria-label={t("pages.mechanics.workOrders.fieldAmbulance")}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                />
              )}
            </div>
            <div>
              <label
                htmlFor="wo-create-planned"
                className="block text-xs font-medium text-slate-600 mb-1"
              >
                {t("pages.mechanics.workOrders.fieldPlanned")}
              </label>
              <input
                id="wo-create-planned"
                type="datetime-local"
                value={createPlanned}
                onChange={(e) => setCreatePlanned(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                title={t("pages.mechanics.workOrders.fieldPlanned") as string}
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="wo-create-title"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              {t("pages.mechanics.workOrders.fieldTitle")}
            </label>
            <input
              id="wo-create-title"
              required
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
              placeholder={t("pages.mechanics.workOrders.fieldTitle")}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label
              htmlFor="wo-create-desc"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              {t("pages.mechanics.workOrders.fieldDescription")}
            </label>
            <textarea
              id="wo-create-desc"
              value={createDescription}
              onChange={(e) => setCreateDescription(e.target.value)}
              rows={2}
              placeholder={t("pages.mechanics.workOrders.fieldDescription")}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label
              htmlFor="wo-create-assigned"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              {t("pages.mechanics.workOrders.fieldAssigned")}
            </label>
            <input
              id="wo-create-assigned"
              value={createAssignedTo}
              onChange={(e) => setCreateAssignedTo(e.target.value)}
              placeholder={t(
                "pages.mechanics.workOrders.assignedPlaceholder",
              )}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting
              ? (t("pages.mechanics.workOrders.creating") as string)
              : (t("pages.mechanics.workOrders.submitCreate") as string)}
          </button>
        </form>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-600">
          {t("pages.mechanics.workOrders.loading")}
        </p>
      ) : orders.length === 0 ? (
        <p className="text-sm text-slate-600">
          {t("pages.mechanics.workOrders.empty")}
        </p>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => {
            const tone = statusTone(o.status);
            const toneClass =
              tone === "emerald"
                ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
                : tone === "amber"
                  ? "bg-amber-50 text-amber-900 ring-amber-200"
                  : tone === "rose"
                    ? "bg-rose-50 text-rose-900 ring-rose-200"
                    : "bg-slate-50 text-slate-800 ring-slate-200";

            return (
              <li
                key={o._id}
                className="rounded-xl ring-1 ring-slate-200 bg-white p-4 flex flex-col gap-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${toneClass}`}
                    >
                      {statusLabel(o.status)}
                    </span>
                    <h3 className="mt-1 font-medium text-slate-900">
                      {o.title}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {t("pages.mechanics.workOrders.metaAmbulance")}: #
                      {o.ambulanceNumber}
                      {o.plannedFor
                        ? ` · ${t("pages.mechanics.workOrders.metaPlanned")}: ${new Date(o.plannedFor).toLocaleString()}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {isMechanic && o.status === "pending" ? (
                      <button
                        type="button"
                        onClick={() => void handleStart(o._id)}
                        className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
                      >
                        {t("pages.mechanics.workOrders.actionStart")}
                      </button>
                    ) : null}
                    {isMechanic && o.status === "in_progress" ? (
                      <button
                        type="button"
                        onClick={() =>
                          setOpenCompleteId((cur) =>
                            cur === o._id ? null : o._id,
                          )
                        }
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        {t("pages.mechanics.workOrders.actionComplete")}
                      </button>
                    ) : null}
                    {canPlan &&
                    (o.status === "pending" || o.status === "in_progress") ? (
                      <button
                        type="button"
                        onClick={() => void handleCancelOrder(o._id)}
                        className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-50"
                      >
                        {t("pages.mechanics.workOrders.actionCancel")}
                      </button>
                    ) : null}
                  </div>
                </div>
                {o.description ? (
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">
                    {o.description}
                  </p>
                ) : null}
                {o.completionNotes && o.status === "completed" ? (
                  <p className="text-sm text-slate-600 border-t border-slate-100 pt-2">
                    <span className="font-semibold">
                      {t("pages.mechanics.workOrders.completionNotes")}:
                    </span>{" "}
                    {o.completionNotes}
                  </p>
                ) : null}
                {openCompleteId === o._id ? (
                  <div className="border-t border-slate-100 pt-3 space-y-2">
                    <label
                      htmlFor={`wo-complete-notes-${o._id}`}
                      className="block text-xs font-medium text-slate-600"
                    >
                      {t("pages.mechanics.workOrders.completionNotesLabel")}
                    </label>
                    <textarea
                      id={`wo-complete-notes-${o._id}`}
                      value={completeNotesById[o._id] ?? ""}
                      onChange={(e) =>
                        setCompleteNotesById((prev) => ({
                          ...prev,
                          [o._id]: e.target.value,
                        }))
                      }
                      rows={3}
                      placeholder={t(
                        "pages.mechanics.workOrders.completionNotesLabel",
                      )}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => void handleComplete(o._id)}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      {t("pages.mechanics.workOrders.submitComplete")}
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
