//frontend/src/components/common/TeamPicker.tsx
import { useEffect, useMemo, useState, useId } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useTranslation } from "react-i18next";
import { UsersApi } from "../../modules/users";
import { getPscheinInfo } from "../../utils/pscheinUtils";

export type TeamPickerValue = { driver: string; medic: string };

type UserLite = {
  _id: string;
  name: string;
  lastName: string;
  ambulanceRole?: "driver" | "medic" | "both";
  pscheinExpiry?: string | null; // ⬅️ añadimos para poder aplicar la lógica
};

interface TeamPickerProps {
  value: TeamPickerValue;
  onChange: (next: TeamPickerValue) => void;
  disabled?: boolean;
  /**
   * Si el picker vive dentro de un modal, suele montarse y desmontarse.
   * No hace falta pasar isOpen, el picker cargará al montarse.
   */
}

export default function TeamPicker({
  value,
  onChange,
  disabled,
}: TeamPickerProps) {
  const { token } = useAuth();
  const { t } = useTranslation();

  const [users, setUsers] = useState<UserLite[]>([]);
  const [loading, setLoading] = useState(false);

  // IDs únicos para asociar <label> con <select> (accesibilidad)
  const driverSelectId = useId();
  const medicSelectId = useId();

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        setLoading(true);
        const all = await UsersApi.getAllUsers(token);
        const sorted = [...(all as UserLite[])].sort((a, b) =>
          (a.lastName || "").localeCompare(b.lastName || "", "es"),
        );
        setUsers(sorted);
      } catch (e) {
        console.error("Error cargando usuarios:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const baseLabel = (u: UserLite) =>
    `${u.lastName || ""}${u.lastName ? ", " : ""}${u.name || ""}` || "—";

  // === DRIVER OPTIONS ===
  const rawDriver = useMemo(
    () =>
      users.filter(
        (u) => u.ambulanceRole === "driver" || u.ambulanceRole === "both",
      ),
    [users],
  );

  const driverOptions = useMemo(() => {
    const opts = rawDriver.map((u) => {
      const base = baseLabel(u);
      const ps = getPscheinInfo(u.pscheinExpiry ?? undefined);
      let label = base;
      let isDisabled = false;

      if (ps.status === "expired") {
        label = `${base} — ${t("pages.diensts.adminPage.driverPscheinExpiredLabel", "P-Schein caducado")}`;
        isDisabled = true;
      } else if (ps.status === "warning") {
        // ⚠️ Texto desde i18n con months
        const months = ps.monthsLeft ?? 0;
        const warningText = t("pages.diensts.adminPage.driverPscheinWarning", {
          months,
        }) as string;
        label = `${base} — ${warningText}`;
      }

      // No permitir elegir el mismo que el medic
      if (value.medic && value.medic === u._id) {
        isDisabled = true;
      }

      return {
        id: u._id,
        label,
        disabled: isDisabled,
        sortKey: `${u.lastName || ""} ${u.name || ""}`.toLowerCase(),
      };
    });

    // Habilitados primero, luego alfabético
    return opts.sort((a, b) => {
      if (+a.disabled !== +b.disabled) return +a.disabled - +b.disabled;
      return a.sortKey.localeCompare(b.sortKey, "es");
    });
  }, [rawDriver, value.medic, t]);

  // === MEDIC OPTIONS ===
  const medicOptions = useMemo(() => {
    const raw = users.filter(
      (u) => u.ambulanceRole === "medic" || u.ambulanceRole === "both",
    );
    const opts = raw.map((u) => ({
      id: u._id,
      label: baseLabel(u),
      disabled: !!value.driver && value.driver === u._id,
      sortKey: `${u.lastName || ""} ${u.name || ""}`.toLowerCase(),
    }));

    return opts.sort((a, b) => {
      if (+a.disabled !== +b.disabled) return +a.disabled - +b.disabled;
      return a.sortKey.localeCompare(b.sortKey, "es");
    });
  }, [users, value.driver]);

  return (
    <div className="space-y-3">
      {loading && (
        <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
          {t("common.loading", "Cargando...")}
        </div>
      )}

      {/* DRIVER */}
      <div className="space-y-1">
        <label
          htmlFor={driverSelectId}
          className="block text-sm font-medium text-slate-700"
        >
          {t("pages.adminTeams.modal.driver", "Conductor")}
        </label>
        <select
          id={driverSelectId}
          name="driver"
          disabled={disabled}
          className="w-full rounded-xl border border-slate-300 ring-1 ring-slate-200 px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:bg-slate-50"
          value={value.driver}
          onChange={(e) => onChange({ ...value, driver: e.target.value })}
        >
          <option value="">{t("common.select", "Selecciona")}</option>
          {driverOptions.map((opt) => (
            <option key={opt.id} value={opt.id} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[11px] text-slate-500">
          ❌ {t("pages.diensts.adminPage.legendExpired", "P-Schein caducado")} ·{" "}
          🚫 {t("pages.diensts.adminPage.legendCantDrive", "No puede conducir")}
        </p>
      </div>

      {/* MEDIC */}
      <div className="space-y-1">
        <label
          htmlFor={medicSelectId}
          className="block text-sm font-medium text-slate-700"
        >
          {t("pages.adminTeams.modal.medic", "Sanitario")}
        </label>
        <select
          id={medicSelectId}
          name="medic"
          disabled={disabled}
          className="w-full rounded-xl border border-slate-300 ring-1 ring-slate-200 px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:bg-slate-50"
          value={value.medic}
          onChange={(e) => onChange({ ...value, medic: e.target.value })}
        >
          <option value="">{t("common.select", "Selecciona")}</option>
          {medicOptions.map((opt) => (
            <option key={opt.id} value={opt.id} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
