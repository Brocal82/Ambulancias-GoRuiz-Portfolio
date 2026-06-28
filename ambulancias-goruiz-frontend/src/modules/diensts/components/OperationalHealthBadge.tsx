/**
 * Phase 2.3 — Compact operational health indicator for the Scheduling admin header.
 *
 * Shows: current status, last scan time, Scan button.
 * No automatic scans — manual only.
 */

export type HealthStatus = "never" | "healthy" | "warning" | "outdated";

interface Props {
  status: HealthStatus;
  inconsistencyCount: number;
  lastScannedAt: Date | null;
  isScanning: boolean;
  onScan: () => void;
}

function statusLabel(
  status: HealthStatus,
  count: number,
): { icon: string; text: string; color: string } {
  if (status === "never") {
    return { icon: "⚪", text: "Sin escanear", color: "text-slate-500" };
  }
  if (status === "outdated") {
    return { icon: "⚪", text: "Escaneo desactualizado", color: "text-slate-500" };
  }
  if (status === "warning") {
    return {
      icon: "⚠️",
      text: count === 1 ? "1 inconsistencia" : `${count} inconsistencias`,
      color: "text-amber-600",
    };
  }
  return { icon: "🟢", text: "Sin incidencias", color: "text-emerald-600" };
}

function formatTime(d: Date | null): string {
  if (!d) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function OperationalHealthBadge({
  status,
  inconsistencyCount,
  lastScannedAt,
  isScanning,
  onScan,
}: Props) {
  const { icon, text, color } = statusLabel(status, inconsistencyCount);

  return (
    <div
      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm shadow-sm"
      data-testid="operational-health-badge"
    >
      <span className={`font-medium ${color}`} data-testid="health-status-text">
        {icon} {text}
      </span>

      {lastScannedAt && (
        <span
          className="text-xs text-slate-400"
          data-testid="health-last-scanned"
        >
          · {formatTime(lastScannedAt)}
        </span>
      )}

      <button
        type="button"
        onClick={onScan}
        disabled={isScanning}
        className="rounded px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        data-testid="health-scan-button"
      >
        {isScanning ? "Escaneando…" : "Escanear"}
      </button>
    </div>
  );
}
