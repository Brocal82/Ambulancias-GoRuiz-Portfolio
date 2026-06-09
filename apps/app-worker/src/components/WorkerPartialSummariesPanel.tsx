import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { MechanicsIssueReport } from "../services/mechanics";
import type { AssignedDayUser, WorkdaySummary, WorkdaySummaryTrip } from "../services/workday";
import {
  calcWorkdayTripKm,
  calculateEffectivePatientsFromSummaryTrips,
  formatPraemieValue,
  getWorkdayTripPraemieMultiplier,
} from "../utils/workdayTripPraemie";

type Props = {
  summaries: WorkdaySummary[];
  driverLabel: string;
  medicLabel: string;
  issuesToday?: MechanicsIssueReport[];
};

function workerName(field: string | AssignedDayUser | undefined): string {
  if (!field) return "—";
  if (typeof field === "string") return field.trim() || "—";
  const parts = [field.name, field.lastName].filter((p) => (p ?? "").trim()).join(" ");
  return parts.trim() || "—";
}

function issueForSummary(
  summary: WorkdaySummary,
  issues: MechanicsIssueReport[],
): MechanicsIssueReport | undefined {
  const amb = summary.ambulanceNumber?.trim();
  const km = summary.finalKm;
  return issues.find((issue) => {
    if (issue.assignmentId && issue.assignmentId === summary.assignmentId) return true;
    if (!amb || !issue.ambulanceNumber?.trim()) return false;
    if (issue.ambulanceNumber.trim() !== amb) return false;
    if (km != null && issue.finalKm != null && issue.finalKm === km) return true;
    return issue.ambulanceNumber.trim() === amb;
  });
}

function sortedTrips(trips: WorkdaySummaryTrip[] | undefined): WorkdaySummaryTrip[] {
  if (!trips?.length) return [];
  return [...trips].sort((a, b) =>
    (a.timeWarning ?? "").localeCompare(b.timeWarning ?? ""),
  );
}

function PartialSummaryDetailModal({
  summary,
  driverLabel,
  medicLabel,
  issue,
  onClose,
}: {
  summary: WorkdaySummary;
  driverLabel: string;
  medicLabel: string;
  issue?: MechanicsIssueReport;
  onClose: () => void;
}) {
  const detailDriver = workerName(summary.driver) || driverLabel;
  const detailMedic = workerName(summary.medic) || medicLabel;
  const amb = summary.ambulanceNumber?.trim() || "—";
  const reason = summary.partialClosureReason?.trim() || "Sin motivo";
  const trips = sortedTrips(summary.trips);
  const realTrips =
    summary.totalRealTrips ?? trips.filter((t) => t.countsTrip === 1).length;
  const praemieTotal =
    summary.totalEffectivePatients ??
    calculateEffectivePatientsFromSummaryTrips(trips, summary.date, summary.startTime);
  const initialKm =
    summary.initialKm != null && Number.isFinite(summary.initialKm)
      ? String(Math.round(summary.initialKm))
      : "—";
  const finalKm =
    summary.finalKm != null && Number.isFinite(summary.finalKm)
      ? String(Math.round(summary.finalKm))
      : "—";

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Cierre parcial</Text>
            <Pressable
              onPress={onClose}
              style={styles.modalCloseBtn}
              accessibilityRole="button"
              accessibilityLabel="Cerrar detalle"
            >
              <Ionicons name="close" size={22} color="#334155" />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalBody}>
            <View style={styles.modalTopRow}>
              <View style={styles.modalTeamCol}>
                <Text style={styles.modalBlockLabel}>Equipo</Text>
                <Text style={styles.modalTeamLine} numberOfLines={1}>
                  {detailDriver}
                </Text>
                <Text style={styles.modalTeamLine} numberOfLines={1}>
                  {detailMedic}
                </Text>
              </View>

              <View style={styles.modalTripsCol}>
                <Text style={styles.modalBlockLabel}>Viajes</Text>
                <Text style={styles.modalTripsCount}>
                  {realTrips} viaje{realTrips === 1 ? "" : "s"}
                </Text>
                <Text style={styles.modalPraemieTotal}>
                  {formatPraemieValue(praemieTotal)} Prämie
                </Text>
              </View>
            </View>

            <Text style={styles.modalMetaLine} numberOfLines={2}>
              {amb} · {reason} · {initialKm}→{finalKm}
            </Text>

            {issue ? (
              <View style={styles.modalIssueBanner}>
                <Ionicons name="warning" size={14} color="#b45309" />
                <Text style={styles.modalIssueText} numberOfLines={3}>
                  {issue.issueText.trim()}
                </Text>
              </View>
            ) : null}

            {trips.length > 0 ? (
              <View style={styles.tripTable}>
                <View style={styles.tripTableHead}>
                  <Text style={[styles.tripHeadCell, styles.tripColAuf]}>Auftrag</Text>
                  <Text style={[styles.tripHeadCell, styles.tripColPat]}>Paciente</Text>
                  <Text style={[styles.tripHeadCell, styles.tripColKm]}>Km</Text>
                  <Text style={[styles.tripHeadCell, styles.tripColPr]}>Prämie</Text>
                </View>

                {trips.map((trip, idx) => {
                  const km = calcWorkdayTripKm(trip);
                  const praemie = getWorkdayTripPraemieMultiplier(
                    trip,
                    summary.date,
                    summary.startTime,
                  );
                  const isStorno = Boolean(trip.wasCancelled);
                  const stornoNoCount = isStorno && trip.countsTrip === 0;

                  return (
                    <View
                      key={`${trip.auftragNumber ?? "t"}-${idx}`}
                      style={[styles.tripTableRow, idx % 2 === 1 ? styles.tripTableRowAlt : null]}
                    >
                      <Text
                        style={[
                          styles.tripCell,
                          styles.tripColAuf,
                          isStorno ? styles.tripCellStorno : null,
                        ]}
                        numberOfLines={2}
                      >
                        {trip.auftragNumber?.trim() || "—"}
                      </Text>
                      <Text style={[styles.tripCell, styles.tripColPat]} numberOfLines={2}>
                        {trip.patientName?.trim() || "—"}
                      </Text>
                      <Text style={[styles.tripCell, styles.tripColKm, styles.tripCellMetric]}>
                        {km}
                      </Text>
                      <Text
                        style={[
                          styles.tripCell,
                          styles.tripColPr,
                          styles.tripCellMetric,
                          styles.tripCellPraemie,
                          stornoNoCount ? styles.tripCellMuted : null,
                          isStorno && !stornoNoCount ? styles.tripCellStornoOk : null,
                        ]}
                      >
                        {formatPraemieValue(praemie)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function WorkerPartialSummariesPanel({
  summaries,
  driverLabel,
  medicLabel,
  issuesToday = [],
}: Props) {
  const [detailSummary, setDetailSummary] = useState<WorkdaySummary | null>(null);

  const ordered = useMemo(
    () => [...summaries].sort((a, b) => String(a._id).localeCompare(String(b._id))),
    [summaries],
  );

  if (!ordered.length) return null;

  const detailIssue = detailSummary ? issueForSummary(detailSummary, issuesToday) : undefined;

  return (
    <>
      <View style={styles.strip}>
        {ordered.map((summary) => {
          const issue = issueForSummary(summary, issuesToday);
          const reason = summary.partialClosureReason?.trim() || "Sin motivo";
          const amb = summary.ambulanceNumber?.trim() || "—";
          const effective =
            summary.totalEffectivePatients ??
            summary.totalRealTrips ??
            summary.trips?.length ??
            0;
          const effectiveCount = String(effective);

          return (
            <Pressable
              key={summary._id}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              onPress={() => setDetailSummary(summary)}
              accessibilityRole="button"
              accessibilityLabel={`Ambulancia ${amb}, ${reason}, ${effective} viajes efectivos`}
            >
              <View style={styles.cardRow}>
                <View style={styles.colAmb}>
                  <Text style={styles.colAmbText} numberOfLines={1}>
                    {amb}
                  </Text>
                </View>

                <View style={styles.colReason}>
                  <Text style={styles.colReasonText} numberOfLines={2} ellipsizeMode="tail">
                    {reason}
                  </Text>
                </View>

                <View style={styles.colEffective}>
                  <Text style={styles.colEffectiveText} numberOfLines={1}>
                    {effectiveCount}
                  </Text>
                </View>

                <View style={styles.colTrailing}>
                  {issue ? (
                    <Ionicons name="warning" size={14} color="#b45309" />
                  ) : null}
                  <Ionicons name="chevron-forward" size={16} color="#64748b" />
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>

      {detailSummary ? (
        <PartialSummaryDetailModal
          summary={detailSummary}
          driverLabel={driverLabel}
          medicLabel={medicLabel}
          issue={detailIssue}
          onClose={() => setDetailSummary(null)}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  strip: {
    gap: 6,
    alignSelf: "stretch",
    width: "100%",
  },
  card: {
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 9,
    width: "100%",
  },
  cardPressed: {
    opacity: 0.92,
    backgroundColor: "#fef3c7",
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    gap: 6,
  },
  colAmb: {
    flex: 1,
    minWidth: 48,
    paddingHorizontal: 4,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: "#fcd34d",
  },
  colAmbText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#92400e",
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  colReason: {
    flex: 2.2,
    minWidth: 0,
    paddingHorizontal: 4,
  },
  colReasonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#78350f",
    lineHeight: 16,
  },
  colEffective: {
    flex: 0.7,
    minWidth: 32,
    paddingHorizontal: 4,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: "#fcd34d",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  colEffectiveText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#92400e",
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  colTrailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
    marginLeft: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    maxHeight: "88%",
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBody: {
    paddingHorizontal: 8,
    paddingTop: 14,
    paddingBottom: 24,
    gap: 12,
  },
  modalTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  modalTeamCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  modalTripsCol: {
    flex: 1,
    minWidth: 0,
    alignItems: "flex-end",
    gap: 2,
  },
  modalBlockLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.35,
    marginBottom: 2,
  },
  modalTeamLine: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
    lineHeight: 18,
  },
  modalTripsCount: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
    textAlign: "right",
  },
  modalPraemieTotal: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f766e",
    textAlign: "right",
  },
  modalMetaLine: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
    lineHeight: 18,
    textAlign: "center",
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  modalIssueBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  modalIssueText: {
    flex: 1,
    fontSize: 13,
    color: "#b45309",
    lineHeight: 18,
    fontWeight: "600",
  },
  tripTable: {
    alignSelf: "stretch",
    width: "100%",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#ffffff",
  },
  tripTableHead: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f172a",
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  tripHeadCell: {
    fontSize: 10,
    fontWeight: "700",
    color: "#e2e8f0",
    textTransform: "uppercase",
    textAlign: "center",
    letterSpacing: 0.2,
  },
  tripTableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e2e8f0",
  },
  tripTableRowAlt: {
    backgroundColor: "#f8fafc",
  },
  tripCell: {
    fontSize: 11,
    fontWeight: "600",
    color: "#334155",
    textAlign: "center",
    lineHeight: 15,
  },
  tripCellMetric: {
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
    color: "#0f172a",
  },
  tripCellPraemie: {
    color: "#0f766e",
  },
  tripCellStorno: {
    color: "#be123c",
  },
  tripCellStornoOk: {
    color: "#047857",
  },
  tripCellMuted: {
    color: "#94a3b8",
  },
  tripColAuf: {
    flex: 1.3,
    minWidth: 0,
    paddingHorizontal: 4,
  },
  tripColPat: {
    flex: 1.55,
    minWidth: 0,
    paddingHorizontal: 4,
  },
  tripColKm: {
    flex: 0.75,
    minWidth: 0,
    paddingHorizontal: 4,
  },
  tripColPr: {
    flex: 0.75,
    minWidth: 0,
    paddingHorizontal: 4,
  },
});
