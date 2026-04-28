import axios from "../../../api/axios";
import type { SecurityMonitoringSnapshot } from "./types";

export async function getSecurityMonitoringSummary(
  hours = 24,
): Promise<SecurityMonitoringSnapshot> {
  const safeHours = Number.isFinite(hours) ? Math.max(1, Math.min(168, Math.floor(hours))) : 24;
  const res = await axios.get<SecurityMonitoringSnapshot>(
    `/support-access/monitoring/daily-summary?hours=${safeHours}`,
  );
  return res.data;
}
