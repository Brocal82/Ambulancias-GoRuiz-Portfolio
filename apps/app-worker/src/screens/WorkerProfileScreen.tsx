import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  buildPublicFileCandidates,
  downloadAndOpenAuthenticatedFile,
  filenameFromUrlOrPath,
} from "../services/secureFiles";
import { AuthUser } from "../types/auth";

type Props = {
  user: AuthUser;
  onRefreshProfile: () => Promise<void>;
};

function resolveImageUrl(path: string): string {
  const candidates = buildPublicFileCandidates(path);
  return candidates[0] ?? path;
}

function formatAmbulanceRole(value: AuthUser["ambulanceRole"]): string {
  if (value === "driver") return "Conductor";
  if (value === "medic") return "Sanitario";
  if (value === "both") return "Mixto";
  return "No informado";
}

function truncateMiddle(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  const keep = Math.max(6, Math.floor((maxLength - 3) / 2));
  return `${value.slice(0, keep)}...${value.slice(-keep)}`;
}

function FieldRow({
  label,
  value,
  emptyFallback = "No informado",
}: {
  label: string;
  value?: string | null;
  emptyFallback?: string;
}) {
  const normalized = (value ?? "").toString().trim();
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{normalized.length > 0 ? normalized : emptyFallback}</Text>
    </View>
  );
}

export function WorkerProfileScreen({ user, onRefreshProfile }: Props) {
  const hasBootstrappedRef = useRef(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionError, setActionError] = useState<string | undefined>(undefined);
  const [isOpeningDocument, setIsOpeningDocument] = useState(false);

  const displayName = useMemo(() => {
    return `${user.name ?? ""} ${user.lastName ?? ""}`.trim() || "Usuario";
  }, [user.lastName, user.name]);

  const profileImageUrl = useMemo(() => {
    if (!user.profileImage || user.profileImage.trim().length === 0) return null;
    return resolveImageUrl(user.profileImage.trim());
  }, [user.profileImage]);

  const pscheinDocument = useMemo(() => {
    return (user.pscheinDocument ?? "").trim();
  }, [user.pscheinDocument]);
  const pscheinFilename = useMemo(() => {
    if (!pscheinDocument) return null;
    return filenameFromUrlOrPath(pscheinDocument) ?? "Documento P-Schein";
  }, [pscheinDocument]);

  const onRefresh = async () => {
    setActionError(undefined);
    setIsRefreshing(true);
    try {
      await onRefreshProfile();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "No se pudo refrescar el perfil.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleOpenPschein = async () => {
    if (!pscheinDocument || isOpeningDocument) return;
    setActionError(undefined);
    setIsOpeningDocument(true);
    try {
      const filename = filenameFromUrlOrPath(pscheinDocument);
      if (!filename) {
        throw new Error("No se pudo identificar el documento del perfil.");
      }
      await downloadAndOpenAuthenticatedFile(filename);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "No se pudo abrir el documento.");
    } finally {
      setIsOpeningDocument(false);
    }
  };

  useEffect(() => {
    if (hasBootstrappedRef.current) return;
    hasBootstrappedRef.current = true;

    let isMounted = true;
    const runInitialRefresh = async () => {
      try {
        // Silent bootstrap: refresh once without bloquear UI/spinner persistente.
        await Promise.race([
          onRefreshProfile(),
          new Promise((resolve) => setTimeout(resolve, 8000)),
        ]);
      } catch (error) {
        if (!isMounted) return;
        setActionError(error instanceof Error ? error.message : "No se pudo cargar el perfil.");
      }
    };
    void runInitialRefresh();
    return () => {
      isMounted = false;
    };
  }, [onRefreshProfile]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void onRefresh()} />}
      >
        <View style={styles.headerCard}>
          <Text style={styles.screenTitle}>Perfil</Text>
          <Text style={styles.screenSubtitle}>Datos de cuenta y documentos</Text>
          <Pressable
            style={[styles.refreshButton, isRefreshing && styles.refreshButtonDisabled]}
            onPress={() => void onRefresh()}
            disabled={isRefreshing}
          >
            <Text style={styles.refreshButtonText}>
              {isRefreshing ? "Refrescando..." : "Refrescar perfil"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <View style={styles.avatarBlock}>
            {profileImageUrl ? (
              <Image source={{ uri: profileImageUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarPlaceholderText}>Sin avatar</Text>
              </View>
            )}
            <Text style={styles.nameText}>{displayName}</Text>
          </View>

          <FieldRow label="Nombre" value={user.name} />
          <FieldRow label="Apellidos" value={user.lastName} />
          <FieldRow label="Email" value={user.email} />
          <FieldRow label="Telefono" value={user.phone} emptyFallback="Sin telefono" />
          <FieldRow label="Direccion" value={user.address} emptyFallback="Sin direccion" />
          <FieldRow
            label="Telefono emergencia"
            value={user.emergencyPhone}
            emptyFallback="Sin telefono de emergencia"
          />
          <FieldRow label="Numero empleado" value={user.employeeNumber} emptyFallback="Sin numero" />
          <FieldRow label="Rol ambulancia" value={formatAmbulanceRole(user.ambulanceRole)} />
          <FieldRow
            label="P-Schein caducidad"
            value={user.pscheinExpiry}
            emptyFallback="Pendiente de validacion"
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Documento de perfil</Text>
          <View
            style={[styles.documentStatusPill, pscheinDocument ? styles.documentStatusOk : styles.documentStatusEmpty]}
          >
            <Text
              style={[
                styles.documentStatusText,
                pscheinDocument ? styles.documentStatusTextOk : styles.documentStatusTextEmpty,
              ]}
            >
              {pscheinDocument ? "Documento disponible" : "Documento no disponible"}
            </Text>
          </View>
          {pscheinDocument ? (
            <View style={styles.documentRow}>
              <Text style={styles.documentName} numberOfLines={1}>
                {truncateMiddle(pscheinFilename ?? "Documento P-Schein", 36)}
              </Text>
              <Pressable
                style={[styles.openButton, isOpeningDocument && styles.openButtonDisabled]}
                onPress={() => void handleOpenPschein()}
                disabled={isOpeningDocument}
              >
                {isOpeningDocument ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.openButtonText}>Abrir</Text>
                )}
              </Pressable>
            </View>
          ) : (
            <Text style={styles.emptyText}>No hay documento P-Schein cargado.</Text>
          )}
        </View>

        {actionError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{actionError}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  content: {
    padding: 16,
    gap: 12,
  },
  headerCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0f172a",
  },
  screenSubtitle: {
    fontSize: 14,
    color: "#64748b",
  },
  refreshButton: {
    marginTop: 8,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#0f766e",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#ffffff",
  },
  refreshButtonDisabled: {
    opacity: 0.7,
  },
  refreshButtonText: {
    color: "#0f766e",
    fontWeight: "700",
    fontSize: 12,
  },
  card: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  avatarBlock: {
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  avatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: "#e2e8f0",
  },
  avatarPlaceholder: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarPlaceholderText: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "600",
  },
  nameText: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 16,
  },
  fieldRow: {
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 8,
    gap: 2,
  },
  fieldLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "600",
  },
  fieldValue: {
    color: "#0f172a",
    fontSize: 14,
  },
  sectionTitle: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 15,
  },
  documentStatusPill: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  documentStatusOk: {
    borderColor: "#86efac",
    backgroundColor: "#f0fdf4",
  },
  documentStatusEmpty: {
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  documentStatusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  documentStatusTextOk: {
    color: "#166534",
  },
  documentStatusTextEmpty: {
    color: "#475569",
  },
  documentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  documentName: {
    flex: 1,
    color: "#334155",
    fontSize: 13,
  },
  openButton: {
    borderRadius: 8,
    backgroundColor: "#0f766e",
    minWidth: 72,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  openButtonDisabled: {
    opacity: 0.7,
  },
  openButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 12,
  },
  emptyText: {
    color: "#64748b",
  },
  errorBox: {
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 12,
    padding: 10,
    backgroundColor: "#fff1f2",
  },
  errorText: {
    color: "#b91c1c",
  },
});
