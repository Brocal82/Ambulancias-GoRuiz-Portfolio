import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ApiError } from "../services/http";
import { WorkdayTrip, getWorkdayTripsByDate } from "../services/workday";
import { AuthUser } from "../types/auth";
import { parseHHMM } from "../utils/tripValidators";

type Props = {
  user: AuthUser;
  onClose: () => void;
};

type ClosureMenuKey = "inicio" | "checks" | "viajes" | "averias" | "envio";

function todayDateKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function tripCountsTowardWorkday(trip: WorkdayTrip): boolean {
  return trip.countsTrip !== 0;
}

function tripKmForDisplay(trip: WorkdayTrip): string {
  if (typeof trip.totalKm === "number" && !Number.isNaN(trip.totalKm)) {
    return String(Math.round(trip.totalKm));
  }
  const ks = typeof trip.kmStart === "number" && !Number.isNaN(trip.kmStart) ? trip.kmStart : null;
  const ke = typeof trip.kmEnd === "number" && !Number.isNaN(trip.kmEnd) ? trip.kmEnd : null;
  if (ks != null && ke != null && ke >= ks) {
    return String(Math.round(ke - ks));
  }
  return "—";
}

function tripDurationMinutes(trip: WorkdayTrip): number | null {
  const candidatesStart = [trip.timeWarning, trip.timeAtHome];
  let startStr: string | undefined;
  for (const c of candidatesStart) {
    const t = c?.trim();
    if (t && !Number.isNaN(parseHHMM(t))) {
      startStr = t;
      break;
    }
  }
  if (!startStr) return null;

  const te = trip.timeEnd?.trim();
  let endStr: string | undefined;
  if (te && !Number.isNaN(parseHHMM(te))) {
    endStr = te;
  } else {
    const ta = trip.timeArrival?.trim();
    if (ta && !Number.isNaN(parseHHMM(ta))) {
      endStr = ta;
    }
  }
  if (!endStr) return null;

  const startMin = parseHHMM(startStr);
  const endMin = parseHHMM(endStr);
  if (Number.isNaN(startMin) || Number.isNaN(endMin)) return null;
  let delta = endMin - startMin;
  if (delta < 0) {
    delta += 24 * 60;
  }
  return delta;
}

const MENU: {
  key: ClosureMenuKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: "inicio", label: "Inicio", icon: "home-outline" },
  { key: "checks", label: "Amb. checks", icon: "medkit-outline" },
  { key: "viajes", label: "Viajes", icon: "map-outline" },
  { key: "averias", label: "Averias", icon: "warning-outline" },
  { key: "envio", label: "Envio", icon: "send-outline" },
];

export function WorkerWorkdayClosureScreen({ user: _user, onClose }: Props) {
  const [activeKey, setActiveKey] = useState<ClosureMenuKey>("inicio");
  const [trips, setTrips] = useState<WorkdayTrip[]>([]);
  const [loadError, setLoadError] = useState<string | undefined>(undefined);
  const [loadingTrips, setLoadingTrips] = useState(true);

  const loadTrips = useCallback(async () => {
    setLoadingTrips(true);
    setLoadError(undefined);
    try {
      const list = await getWorkdayTripsByDate(todayDateKey());
      setTrips(list);
    } catch (e) {
      if (e instanceof ApiError) {
        setLoadError(e.message);
      } else {
        setLoadError("No se pudieron cargar los viajes.");
      }
    } finally {
      setLoadingTrips(false);
    }
  }, []);

  useEffect(() => {
    void loadTrips();
  }, [loadTrips]);

  const tripsCounted = useMemo(
    () => trips.filter(tripCountsTowardWorkday).length,
    [trips],
  );

  const bodyEl = useMemo(() => {
    switch (activeKey) {
      case "inicio":
        return (
          <View style={styles.placeholderBlock}>
            <Text style={styles.placeholderTitle}>Resumen del dia</Text>
            <Text style={styles.placeholderText}>
              Aqui podras revisar el cierre del dia: valores de O2, kilometros finales de ambulancia,
              averias y envio del reporte al administrador.
            </Text>
            <View style={styles.statPill}>
              <Text style={styles.statPillLabel}>Viajes registrados (hoy)</Text>
              <Text style={styles.statPillValue}>{tripsCounted}</Text>
            </View>
            <Text style={styles.placeholderHint}>Menu inferior (solo maquetacion por ahora).</Text>
          </View>
        );
      case "checks":
        return (
          <View style={styles.placeholderBlock}>
            <Text style={styles.placeholderTitle}>Checks de ambulancia</Text>
            <Text style={styles.placeholderText}>
              Proximamente: checklist del vehiculo, lecturas de O2 y otros valores al cierre.
            </Text>
          </View>
        );
      case "viajes":
        if (loadingTrips) {
          return (
            <View style={styles.centerInline}>
              <ActivityIndicator color="#0f766e" />
              <Text style={styles.mutedSmall}>Cargando viajes…</Text>
            </View>
          );
        }
        if (loadError) {
          return (
            <View style={styles.placeholderBlock}>
              <Text style={styles.errorInline}>{loadError}</Text>
              <Pressable style={styles.retryMini} onPress={() => void loadTrips()}>
                <Text style={styles.retryMiniText}>Reintentar</Text>
              </Pressable>
            </View>
          );
        }
        if (trips.length === 0) {
          return (
            <Text style={styles.placeholderText}>No hay viajes registrados hoy.</Text>
          );
        }
        return (
          <View style={styles.tripListWrap}>
            {trips.map((trip) => {
              const auf = (trip.auftragNumber ?? "").trim() || "—";
              const pat = (trip.patientName ?? "").trim() || "—";
              const dur = tripDurationMinutes(trip);
              const km = tripKmForDisplay(trip);
              const minText = dur != null ? `${dur} min` : "—";
              const kmText = km === "—" ? "—" : `${km} km`;
              const isStorno = Boolean(trip.wasCancelled);
              const stornoCounts = trip.countsTrip === 0 ? "0" : "+1";
              return (
                <View key={trip._id} style={styles.tripGridRow}>
                  <View style={styles.tripColAuf}>
                    <Text
                      style={[styles.tripCellText, isStorno ? styles.tripCellStorno : null]}
                      numberOfLines={2}
                      ellipsizeMode="tail"
                    >
                      {auf}
                    </Text>
                    {isStorno ? (
                      <Text style={styles.tripStornoBadge} numberOfLines={1}>
                        Storno · {stornoCounts}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.tripColPat}>
                    <Text style={styles.tripCellText} numberOfLines={2} ellipsizeMode="tail">
                      {pat}
                    </Text>
                  </View>
                  <View style={styles.tripColMin}>
                    <Text style={styles.tripMetricText} numberOfLines={1}>
                      {minText}
                    </Text>
                  </View>
                  <View style={styles.tripColKm}>
                    <Text style={styles.tripMetricText} numberOfLines={1}>
                      {kmText}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        );
      case "averias":
        return (
          <View style={styles.placeholderBlock}>
            <Text style={styles.placeholderTitle}>Averias</Text>
            <Text style={styles.placeholderText}>
              Proximamente: registro de averias de ambulancia durante la jornada.
            </Text>
          </View>
        );
      case "envio":
        return (
          <View style={styles.placeholderBlock}>
            <Text style={styles.placeholderTitle}>Envio de reporte</Text>
            <Text style={styles.placeholderText}>
              Proximamente: cierre parcial o final y envio al administrador.
            </Text>
          </View>
        );
      default:
        return null;
    }
  }, [activeKey, loadError, loadingTrips, loadTrips, trips, tripsCounted]);

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [styles.backBtn, pressed ? styles.backBtnPressed : null]}
          accessibilityRole="button"
          accessibilityLabel="Volver a Mi jornada"
          hitSlop={10}
        >
          <Ionicons name="chevron-back" size={26} color="#0f766e" />
        </Pressable>
        <View style={styles.topBarTitleWrap}>
          <Text style={styles.topBarTitle} numberOfLines={1}>
            Jornada en curso
          </Text>
          <Text style={styles.topBarSubtitle} numberOfLines={1}>
            Cierre del dia
          </Text>
        </View>
        <View style={styles.topBarRightSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {bodyEl}
      </ScrollView>

      <View style={styles.closureBottomNav}>
        {MENU.map((item) => {
          const active = activeKey === item.key;
          return (
            <Pressable
              key={item.key}
              style={styles.closureTabButton}
              onPress={() => setActiveKey(item.key)}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: active }}
            >
              <Ionicons
                name={item.icon}
                size={21}
                color={active ? "#0f766e" : "#64748b"}
                style={styles.closureTabIcon}
              />
              <Text
                style={[styles.closureTabText, active ? styles.closureTabTextActive : null]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },
  backBtnPressed: {
    opacity: 0.75,
    backgroundColor: "#e2e8f0",
  },
  topBarTitleWrap: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  topBarSubtitle: {
    marginTop: 1,
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
  },
  topBarRightSpacer: {
    width: 44,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    flexGrow: 1,
  },
  placeholderBlock: {
    gap: 10,
  },
  placeholderTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  placeholderText: {
    fontSize: 14,
    color: "#475569",
    lineHeight: 20,
  },
  placeholderHint: {
    marginTop: 4,
    fontSize: 12,
    color: "#94a3b8",
    fontStyle: "italic",
  },
  statPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  statPillLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#047857",
  },
  statPillValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#047857",
    fontVariant: ["tabular-nums"],
  },
  centerInline: {
    paddingVertical: 24,
    alignItems: "center",
    gap: 8,
  },
  mutedSmall: {
    fontSize: 13,
    color: "#64748b",
  },
  errorInline: {
    color: "#b91c1c",
    fontSize: 14,
    textAlign: "center",
  },
  retryMini: {
    alignSelf: "center",
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#0f766e",
    backgroundColor: "#ffffff",
  },
  retryMiniText: {
    color: "#0f766e",
    fontWeight: "700",
    fontSize: 13,
  },
  tripListWrap: {
    gap: 0,
  },
  tripGridRow: {
    flexDirection: "row",
    alignItems: "stretch",
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  tripColAuf: {
    flex: 1.1,
    minWidth: 0,
    justifyContent: "center",
  },
  tripColPat: {
    flex: 1.2,
    minWidth: 0,
    justifyContent: "center",
  },
  tripColMin: {
    width: 64,
    flexShrink: 0,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  tripColKm: {
    width: 64,
    flexShrink: 0,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  tripCellText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#334155",
    lineHeight: 15,
  },
  tripCellStorno: {
    color: "#be123c",
  },
  tripStornoBadge: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: "700",
    color: "#be123c",
    letterSpacing: 0.2,
  },
  tripMetricText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0f172a",
    lineHeight: 16,
    fontVariant: ["tabular-nums"],
    textAlign: "right",
    width: "100%",
  },
  closureBottomNav: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    paddingTop: 6,
    paddingBottom: 6,
  },
  closureTabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 2,
    minWidth: 0,
    paddingHorizontal: 1,
  },
  closureTabIcon: {
    marginBottom: 0,
  },
  closureTabText: {
    fontSize: 9,
    color: "#64748b",
    textAlign: "center",
    maxWidth: "100%",
  },
  closureTabTextActive: {
    color: "#0f766e",
    fontWeight: "700",
  },
});
