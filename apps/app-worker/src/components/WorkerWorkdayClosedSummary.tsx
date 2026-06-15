import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { formatPraemieValue } from "../utils/workdayTripPraemie";

type Props = {
  date: string;
  dienstNumber?: number | string | null;
  startTime?: string;
  endTime?: string;
  driverName: string;
  medicName: string;
  totalPraemie: number;
  totalRealTrips: number;
  showPraemieUi?: boolean;
};

function formatDateEs(dateKey: string): string {
  const direct = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey.trim());
  if (direct) {
    return `${direct[3]}/${direct[2]}/${direct[1]}`;
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})T/.exec(dateKey.trim());
  if (iso) {
    return `${iso[3]}/${iso[2]}/${iso[1]}`;
  }
  return dateKey;
}

function dienstLabel(value: Props["dienstNumber"]): string {
  if (value == null || String(value).trim() === "") return "—";
  return `#${String(value).trim()}`;
}

export function WorkerWorkdayClosedSummary({
  date,
  dienstNumber,
  startTime,
  endTime,
  driverName,
  medicName,
  totalPraemie,
  totalRealTrips,
  showPraemieUi = true,
}: Props) {
  const schedule = `${startTime ?? "--:--"} – ${endTime ?? "--:--"}`;
  const tripsLabel = totalRealTrips === 1 ? "1 viaje" : `${totalRealTrips} viajes`;

  return (
    <View style={styles.card}>
      <View style={styles.successRow}>
        <Ionicons name="checkmark-circle" size={22} color="#047857" />
        <Text style={styles.successTitle}>Jornada cerrada</Text>
      </View>

      <View style={styles.dateBlock}>
        <Text style={styles.dateText}>{formatDateEs(date)}</Text>
        <Text style={styles.dienstLine}>
          Dienst {dienstLabel(dienstNumber)} · {schedule}
        </Text>
      </View>

      <View style={styles.splitRow}>
        <View style={styles.teamCol}>
          <Text style={styles.blockLabel}>Equipo</Text>
          <Text style={styles.teamLine} numberOfLines={1}>
            {driverName}
          </Text>
          <Text style={styles.teamLine} numberOfLines={1}>
            {medicName}
          </Text>
        </View>

        <View style={styles.statsCol}>
          {showPraemieUi ? (
            <>
              <Text style={styles.blockLabel}>Prämie</Text>
              <Text style={styles.praemieValue}>{formatPraemieValue(totalPraemie)}</Text>
            </>
          ) : null}
          <Text style={styles.tripsSub}>{tripsLabel}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: "stretch",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#a7f3d0",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 14,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  successRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  successTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#047857",
  },
  dateBlock: {
    gap: 4,
    paddingBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  dateText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  dienstLine: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
    fontVariant: ["tabular-nums"],
  },
  splitRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
  },
  teamCol: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  statsCol: {
    flex: 1,
    minWidth: 0,
    alignItems: "flex-end",
    gap: 3,
  },
  blockLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.35,
    marginBottom: 2,
  },
  teamLine: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
    lineHeight: 19,
  },
  praemieValue: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0f766e",
    fontVariant: ["tabular-nums"],
    lineHeight: 32,
  },
  tripsSub: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
    textAlign: "right",
  },
});
