import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import type { AmbulanceListItem } from "../services/ambulances";

type Props = {
  dienstNumberText: string;
  scheduleLine: string;
  driverName: string;
  medicName: string;
  /** Ambulancia segun asignacion (si no hay selector). */
  assignmentAmbulanceLine: string;
  hasAmbulancesModule: boolean;
  ambulancesLoading: boolean;
  ambulances: AmbulanceListItem[];
  selectedAmbulanceId: string;
  onSelectAmbulance: (id: string, numberForStorage: string) => void;
  initialKm: string;
  onChangeInitialKm: (v: string) => void;
  errorMessage?: string;
  onConfirm: () => void;
  confirmDisabled: boolean;
  confirming: boolean;
};

function ambulanceChipLabel(a: AmbulanceListItem): string {
  const n = a.ambulanceNumber?.trim();
  const p = a.licensePlate?.trim();
  if (n && p) return `#${n} · ${p}`;
  if (n) return `#${n}`;
  if (p) return p;
  return a._id.slice(-6);
}

export function WorkerWorkdayPreamble({
  dienstNumberText,
  scheduleLine,
  driverName,
  medicName,
  assignmentAmbulanceLine,
  hasAmbulancesModule,
  ambulancesLoading,
  ambulances,
  selectedAmbulanceId,
  onSelectAmbulance,
  initialKm,
  onChangeInitialKm,
  errorMessage,
  onConfirm,
  confirmDisabled,
  confirming,
}: Props) {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.lead}>
        Confirma la ambulancia y el odometro inicial antes de registrar viajes (mismo criterio que en la web).
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Asignacion de hoy</Text>
        <View style={styles.threeCol}>
          <View style={[styles.col, styles.colLeft]}>
            <Text style={styles.colLabel}>Dienst</Text>
            <Text style={styles.dienstNum} numberOfLines={1}>
              {dienstNumberText}
            </Text>
            <Text style={styles.scheduleLike} numberOfLines={1}>
              {scheduleLine}
            </Text>
          </View>
          <View style={[styles.col, styles.colCenter]}>
            <Text style={[styles.colLabel, styles.colLabelCenter]}>Team</Text>
            <Text style={[styles.teamLine, styles.teamCenter]} numberOfLines={1} ellipsizeMode="tail">
              {driverName}
            </Text>
            <Text style={[styles.teamLine, styles.teamCenter]} numberOfLines={1} ellipsizeMode="tail">
              {medicName}
            </Text>
          </View>
          <View style={[styles.col, styles.colRight]}>
            <Text style={[styles.colLabel, styles.colLabelRight]}>Ambulancia</Text>
            <Text style={styles.ambLine} numberOfLines={3}>
              {assignmentAmbulanceLine}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Ambulancia del servicio</Text>
        {hasAmbulancesModule && ambulancesLoading ? (
          <View style={styles.inlineLoading}>
            <ActivityIndicator color="#0f766e" />
            <Text style={styles.muted}>Cargando flota…</Text>
          </View>
        ) : hasAmbulancesModule && ambulances.length > 0 ? (
          <View style={styles.selectorWrap}>
            {ambulances.map((a) => {
              const active = a._id === selectedAmbulanceId;
              const num = a.ambulanceNumber?.trim() || "—";
              return (
                <Pressable
                  key={a._id}
                  onPress={() => onSelectAmbulance(a._id, num)}
                  style={({ pressed }) => [
                    styles.ambChip,
                    active ? styles.ambChipActive : null,
                    pressed ? styles.ambChipPressed : null,
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.ambChipText, active ? styles.ambChipTextActive : null]} numberOfLines={2}>
                    {ambulanceChipLabel(a)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Text style={styles.muted}>
            Ambulancia fijada por la asignacion:{" "}
            <Text style={styles.ambInlineStrong}>{assignmentAmbulanceLine}</Text>
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Odometro al inicio del dienst</Text>
        <TextInput
          style={styles.kmInput}
          keyboardType="decimal-pad"
          value={initialKm}
          onChangeText={onChangeInitialKm}
          placeholder="Ej. 128450"
          placeholderTextColor="#94a3b8"
          maxLength={10}
        />
        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.primaryBtn,
          (confirmDisabled || confirming) && styles.primaryBtnDisabled,
          pressed && !confirmDisabled && !confirming ? styles.primaryBtnPressed : null,
        ]}
        onPress={onConfirm}
        disabled={confirmDisabled || confirming}
        accessibilityRole="button"
        accessibilityLabel="Confirmar e ir a Mi jornada"
      >
        {confirming ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.primaryBtnText}>Ir a Mi jornada</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 28,
    gap: 14,
  },
  lead: {
    fontSize: 14,
    color: "#475569",
    lineHeight: 20,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    gap: 10,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: 0.2,
  },
  threeCol: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  col: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  colLeft: {
    alignItems: "flex-start",
  },
  colCenter: {
    alignItems: "center",
  },
  colRight: {
    alignItems: "flex-end",
  },
  colLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748b",
    alignSelf: "stretch",
  },
  colLabelCenter: {
    textAlign: "center",
  },
  colLabelRight: {
    textAlign: "right",
  },
  dienstNum: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0f172a",
    alignSelf: "stretch",
  },
  scheduleLike: {
    fontSize: 11,
    fontWeight: "600",
    color: "#475569",
    lineHeight: 15,
    fontVariant: ["tabular-nums"],
    alignSelf: "stretch",
  },
  teamLine: {
    fontSize: 11,
    fontWeight: "600",
    color: "#334155",
    lineHeight: 14,
    alignSelf: "stretch",
  },
  teamCenter: {
    textAlign: "center",
  },
  ambLine: {
    fontSize: 11,
    fontWeight: "600",
    color: "#334155",
    lineHeight: 15,
    textAlign: "right",
    alignSelf: "stretch",
  },
  muted: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 19,
  },
  ambInlineStrong: {
    fontWeight: "700",
    color: "#0f172a",
  },
  inlineLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  selectorWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  ambChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
    maxWidth: "100%",
  },
  ambChipActive: {
    borderColor: "#0f766e",
    backgroundColor: "#ecfdf5",
  },
  ambChipPressed: {
    opacity: 0.9,
  },
  ambChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
  },
  ambChipTextActive: {
    color: "#047857",
    fontWeight: "800",
  },
  kmInput: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    backgroundColor: "#f8fafc",
    color: "#0f172a",
    fontVariant: ["tabular-nums"],
  },
  error: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "600",
    color: "#b91c1c",
  },
  primaryBtn: {
    marginTop: 4,
    backgroundColor: "#0f766e",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnDisabled: {
    opacity: 0.55,
  },
  primaryBtnPressed: {
    opacity: 0.92,
  },
  primaryBtnText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
});
