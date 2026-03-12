// src/modules/teams/pages/AdminTeamsPage.tsx
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../../../hooks/useAuth";
import { useTranslation } from "react-i18next";

import { getTeams, createTeam, updateTeam, deleteTeam } from "../domain";
import type { Team, UpdateTeamPayload } from "../domain";

import TeamCreateModal from "../components/TeamCreateModal";
import TeamEditModal from "../components/TeamEditModal";

import { toastT } from "../../../utils/toast";
import { getPscheinInfo } from "../../../utils/pscheinUtils";

import { getVacationFlagsInRange, type VacFlag } from "../../vacation/domain/api";
import { getSickFlagsInRange, type SickFlag } from "../../../api/sickLeaves";

import { fmtDDMM } from "../../../utils/timeUtils";
import { getBerlinWeekRangeISO } from "../utils";

import CreateIconButton from "../../../components/common/actions/CreateIconButton";

export default function AdminTeamsPage() {
  const { token } = useAuth();
  const { t } = useTranslation();

  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);

  // 🏖️ / 🤒 Flags semanales por usuario (mapas por userId)
  const [vacationFlags, setVacationFlags] = useState<Record<string, VacFlag>>(
    {},
  );
  const [sickFlags, setSickFlags] = useState<Record<string, SickFlag>>({});

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const data = await getTeams(token);
      setTeams(data);
    } catch (e: any) {
      console.error(e);
      setError(
        e?.response?.data?.message ??
        t("pages.adminTeams.loadError", "No se pudieron cargar los equipos"),
      );
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useEffect(() => {
    load();
  }, [load]);

  // 🏖️/🤒 Cargar flags semanales para todos los usuarios listados en equipos (includeFullSpan para tooltips FULL)
  useEffect(() => {
    if (!token || teams.length === 0) {
      setVacationFlags({});
      setSickFlags({});
      return;
    }

    const ids = new Set<string>();
    for (const team of teams) {
      const dId = (team.driver as any)?._id || (team.driver as any);
      const mId = (team.medic as any)?._id || (team.medic as any);
      if (typeof dId === "string") ids.add(dId);
      if (typeof mId === "string") ids.add(mId);
    }
    const userIds = Array.from(ids);
    if (userIds.length === 0) {
      setVacationFlags({});
      setSickFlags({});
      return;
    }

    const { weekStartISO, weekEndISO } = getBerlinWeekRangeISO();
    let cancelled = false;

    (async () => {
      try {
        const vacPromise = getVacationFlagsInRange(token, {
          userIds,
          fromISO: weekStartISO,
          toISO: weekEndISO,
          includeFullSpan: true,
        });
        const sickPromise = getSickFlagsInRange({
          userIds,
          fromISO: weekStartISO,
          toISO: weekEndISO,
          includeFullSpan: true,
        });

        const [vFlags, sFlags] = await Promise.all([vacPromise, sickPromise]);
        if (!cancelled) {
          setVacationFlags(vFlags);
          setSickFlags(sFlags);
        }
      } catch (e) {
        console.error(
          "❌ Error al cargar flags (vacaciones/bajas) en AdminTeamsPage:",
          e,
        );
        if (!cancelled) {
          setVacationFlags({});
          setSickFlags({});
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, teams]);

  const handleCreate = async (payload: { driver: string; medic: string }) => {
    if (!token) return;
    try {
      await createTeam(payload, token);
      toastT.success(["pages.adminTeams.created"]);
      await load();
    } catch (e: any) {
      console.error(e);
      toastT.error([
        e?.response?.data?.message || "pages.adminTeams.createError",
      ]);
    }
  };

  const handleEdit = (team: Team) => {
    setEditingTeam(team);
  };

  const handleUpdateTeam = async (
    teamId: string,
    payload: UpdateTeamPayload,
  ) => {
    if (!token) return;

    try {
      await updateTeam(teamId, payload, token);
      toastT.success(["pages.adminTeams.updated"]);
      await load();
      setEditingTeam(null);
    } catch (e: any) {
      console.error(e);
      toastT.error([
        e?.response?.data?.message || "pages.adminTeams.updateError",
      ]);
    }
  };

  const handleDelete = async (teamId: string) => {
    if (!token) return;
    const confirmed = confirm(
      t("pages.adminTeams.confirmDelete", "¿Eliminar este equipo?"),
    );
    if (!confirmed) return;

    try {
      await deleteTeam(teamId, token);
      toastT.success(["pages.adminTeams.deleted"]);
      await load();
    } catch (e: any) {
      console.error(e);
      toastT.error([
        e?.response?.data?.message || "pages.adminTeams.deleteError",
      ]);
    }
  };

  // ⚙️ Estilo visual + iconos para conductor según P-Schein
  const getDriverDecor = (team: Team) => {
    const d = team?.driver as any;
    if (!d || typeof d !== "object") {
      return {
        cls: "",
        title: undefined as string | undefined,
        expired: false,
        warning: false,
      };
    }

    const info = getPscheinInfo(d.pscheinExpiry ?? undefined);

    if (info.status === "expired") {
      return {
        cls: "text-red-600 font-medium",
        title: t(
          "pages.diensts.adminPage.driverPscheinExpired",
          "P-Schein caducado, no puede conducir",
        ) as string,
        expired: true,
        warning: false,
      };
    }

    if (info.status === "warning") {
      return {
        cls: "text-amber-600 font-medium",
        title: t("pages.diensts.adminPage.driverPscheinWarning", {
          count: info.monthsLeft ?? 0,
        }) as string,
        expired: false,
        warning: true,
      };
    }

    return { cls: "", title: undefined, expired: false, warning: false };
  };

  // 🔎 Decor vacaciones+baja por persona (tooltip SOLO en iconos; fechas DD/MM; FULL si está)
  const getPersonLeaveDecor = (person: any) => {
    const id: string | undefined =
      typeof person === "object" && person ? person._id : person;
    const vf = id ? vacationFlags[id] : undefined;
    const sf = id ? sickFlags[id] : undefined;

    const hasVac = !!vf?.hasVacationInRange;
    const hasSick = !!sf?.hasSickInRange;

    // Vacaciones tooltip
    const vacFromFull = vf?.vacationStartFull;
    const vacToFull = vf?.vacationUntilFull;
    const vacTitle = hasVac
      ? vacFromFull && vacToFull
        ? `🏖️ ${t("pages.diensts.weekModals.vacations", "Vacaciones")}: ${fmtDDMM(vacFromFull)} → ${fmtDDMM(vacToFull)}`
        : `🏖️ ${t("pages.diensts.weekModals.vacations", "Vacaciones")}`
      : undefined;

    // Bajas tooltip
    const sickFromFull = sf?.sickStartFull || sf?.sickStartInRange;
    const sickToFull = sf?.sickUntilFull || sf?.sickUntilInRange;
    const sickTitle = hasSick
      ? sickFromFull && sickToFull
        ? `🤒 ${t("pages.sick.tooltip.full", "Baja médica")}: ${fmtDDMM(sickFromFull)} → ${fmtDDMM(sickToFull)}`
        : `🤒 ${t("pages.sick.tooltip.full", "Baja médica")}`
      : undefined;

    return {
      dimCls: hasVac || hasSick ? "text-slate-400" : "",
      vacTitle,
      sickTitle,
      showVac: hasVac,
      showSick: hasSick,
    };
  };

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {t("pages.adminTeams.title", "Equipos (driver + medic)")}
          </h1>
          <p className="text-slate-600">
            {t("pages.adminTeams.subtitle", "Crea y gestiona parejas fijas.")}
          </p>
        </div>

        <CreateIconButton
          onClick={() => setShowCreate(true)}
          label={t("pages.adminTeams.createBtn", "Nuevo equipo")}
        />

      </div>

      {loading && (
        <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
          {t("common.loading", "Cargando...")}
        </div>
      )}

      {error && !loading && (
        <div className="rounded-xl bg-rose-50 text-rose-700 ring-1 ring-rose-200 p-4">
          {error}
        </div>
      )}

      {!loading && !error && teams.length === 0 && (
        <div className="rounded-xl bg-white p-6 ring-1 ring-slate-200 text-slate-600">
          {t("pages.adminTeams.empty", "Todavía no hay equipos creados.")}
        </div>
      )}

      {!loading && !error && teams.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {teams.map((team) => {
            // P-Schein conductor
            const {
              cls: driverPscheinCls,
              title: driverPscheinTitle,
              expired: driverExpired,
              warning: driverWarning,
            } = getDriverDecor(team);

            // Vacaciones / Baja por persona (semana FULL tooltip)
            const driverLeave = getPersonLeaveDecor(team.driver);
            const medicLeave = getPersonLeaveDecor(team.medic);

            return (
              <div
                key={team._id}
                className="relative rounded-2xl bg-white p-4 pr-16 ring-1 ring-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-3"
              >
                {/* 🔧 Botones editar + eliminar (más pequeños) */}
                <div className="absolute top-2 right-2 flex gap-1">
                  <button
                    onClick={() => handleEdit(team)}
                    className="rounded-lg bg-slate-200 p-0.5 text-xs text-slate-700 hover:bg-slate-300 transition"
                    title={t("common.edit", "Editar")}
                  >
                    ✏️
                  </button>

                  <button
                    onClick={() => handleDelete(team._id)}
                    className="rounded-lg p-0.5 text-xs text-white hover:bg-rose-500 transition"
                    title={t("common.delete", "Eliminar")}
                  >
                    🗑️
                  </button>
                </div>

                {/* 👥 Miembros del equipo */}
                <div className="space-y-2 mt-2">
                  {/* 🚗 Conductor */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`flex items-center gap-1 font-semibold text-sm ${driverPscheinCls} ${driverLeave.dimCls}`}
                    >
                      <span>🧑‍✈️</span>
                      <span>
                        {team.driver?.lastName || "—"},{" "}
                        {team.driver?.name || "—"}
                      </span>

                      {/* Iconos pegados al nombre */}
                      {driverLeave.showVac && (
                        <span
                          title={driverLeave.vacTitle}
                          className="align-middle cursor-help"
                        >
                          🏖️
                        </span>
                      )}
                      {driverLeave.showSick && (
                        <span
                          title={driverLeave.sickTitle}
                          className="align-middle cursor-help"
                        >
                          🤒
                        </span>
                      )}
                      {driverExpired && (
                        <span
                          title={
                            driverPscheinTitle ||
                            t(
                              "pages.diensts.adminPage.driverPscheinExpired",
                              "P-Schein caducado",
                            )
                          }
                          className="align-middle cursor-help"
                        >
                          🚫
                        </span>
                      )}
                      {!driverExpired && driverWarning && (
                        <span
                          title={driverPscheinTitle}
                          className="align-middle cursor-help"
                        >
                          ⚠️
                        </span>
                      )}
                    </span>
                  </div>

                  {/* 🧑‍⚕️ Sanitario */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`flex items-center gap-1 font-semibold text-sm ${medicLeave.dimCls}`}
                    >
                      <span>🧑‍⚕️</span>
                      <span>
                        {team.medic?.lastName || "—"}, {team.medic?.name || "—"}
                      </span>

                      {/* Iconos pegados al nombre */}
                      {medicLeave.showVac && (
                        <span
                          title={medicLeave.vacTitle}
                          className="align-middle cursor-help"
                        >
                          🏖️
                        </span>
                      )}
                      {medicLeave.showSick && (
                        <span
                          title={medicLeave.sickTitle}
                          className="align-middle cursor-help"
                        >
                          🤒
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                {/* 🔁 Rotación + 🚑 Ambulancia fija */}
                <div className="flex flex-wrap gap-2 text-xs mt-1">
                  {/* Rotación */}
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-slate-700 ring-1 ring-slate-200">
                    <span className="ml-1">
                      {(() => {
                        const mode = team.rotationMode || "rotating";

                        if (mode === "fixed") {
                          const num = team.fixedDienstNumber;
                          return (
                            <>
                              📌{" "}
                              {num
                                ? t(
                                  "pages.adminTeams.rotation.badgeFixedWithNum",
                                  "Dienst #{num}",
                                ).replace("{num}", String(num))
                                : t(
                                  "pages.adminTeams.rotation.badgeFixed",
                                  "Fijo",
                                )}
                            </>
                          );
                        }

                        if (mode === "none") {
                          return (
                            <>
                              ✋{" "}
                              {t(
                                "pages.adminTeams.rotation.badgeNone",
                                "Manual",
                              )}
                            </>
                          );
                        }

                        // rotating
                        return (
                          <>
                            🔁{" "}
                            {t(
                              "pages.adminTeams.rotation.badgeRotating",
                              "Rotación",
                            )}
                          </>
                        );
                      })()}
                    </span>
                  </span>

                  {/* Ambulancia */}
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-slate-700 ring-1 ring-slate-200">
                    🚑{" "}
                    <span className="ml-1">
                      {(() => {
                        const amb: any =
                          team.ambulanceId ||
                          (team as any).ambulance ||
                          (team as any).fixedAmbulance ||
                          null;

                        if (!amb) return "—";
                        if (typeof amb === "string") return amb || "—";
                        if (typeof amb === "object")
                          return amb.ambulanceNumber || "—";
                        return "—";
                      })()}
                    </span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editingTeam && (
        <TeamEditModal
          isOpen={true}
          team={editingTeam}
          onClose={() => setEditingTeam(null)}
          onConfirm={handleUpdateTeam}
        />
      )}

      {showCreate && (
        <TeamCreateModal
          isOpen={showCreate}
          onClose={() => setShowCreate(false)}
          onConfirm={handleCreate}
        />
      )}
    </div>
  );
}

