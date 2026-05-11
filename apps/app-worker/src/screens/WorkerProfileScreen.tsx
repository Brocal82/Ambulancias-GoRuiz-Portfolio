import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

import {
  buildPublicFileCandidates,
  downloadAndOpenAuthenticatedFile,
  filenameFromUrlOrPath,
} from "../services/secureFiles";
import { updateMyProfile, uploadMyFiles, UserFileInput } from "../services/users";
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

function FieldCell({
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
    <View style={styles.fieldPairItem}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue} numberOfLines={1}>{normalized.length > 0 ? normalized : emptyFallback}</Text>
    </View>
  );
}

async function pickImage(source: "camera" | "library"): Promise<UserFileInput | null> {
  const permission =
    source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    Alert.alert("Permiso requerido", "Necesitas permisos para adjuntar archivos.");
    return null;
  }

  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8, mediaTypes: ["images"] })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.8, mediaTypes: ["images"] });

  if (result.canceled || result.assets.length === 0) return null;

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    name: asset.fileName ?? `upload-${Date.now()}.jpg`,
    mimeType: asset.mimeType ?? "image/jpeg",
  };
}

export function WorkerProfileScreen({ user, onRefreshProfile }: Props) {
  const hasBootstrappedRef = useRef(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionError, setActionError] = useState<string | undefined>(undefined);
  const [isOpeningDocument, setIsOpeningDocument] = useState(false);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editPhone, setEditPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editEmergencyPhone, setEditEmergencyPhone] = useState("");
  const [pendingProfileImage, setPendingProfileImage] = useState<UserFileInput | null>(null);
  const [pendingDocument, setPendingDocument] = useState<UserFileInput | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | undefined>(undefined);

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

  const handleOpenEdit = () => {
    setEditPhone(user.phone ?? "");
    setEditAddress(user.address ?? "");
    setEditEmergencyPhone(user.emergencyPhone ?? "");
    setPendingProfileImage(null);
    setPendingDocument(null);
    setSaveError(undefined);
    setEditModalOpen(true);
  };

  const handlePickProfileImage = async (source: "camera" | "library") => {
    const file = await pickImage(source);
    if (file) setPendingProfileImage(file);
  };

  const handlePickDocument = async (source: "camera" | "library") => {
    const file = await pickImage(source);
    if (file) setPendingDocument(file);
  };

  const handleSave = async () => {
    setSaveError(undefined);
    setIsSaving(true);
    try {
      if (pendingProfileImage || pendingDocument) {
        await uploadMyFiles({
          ...(pendingProfileImage ? { profileImage: pendingProfileImage } : {}),
          ...(pendingDocument ? { document: pendingDocument } : {}),
        });
      }
      await updateMyProfile(user._id, {
        phone: editPhone.trim(),
        address: editAddress.trim(),
        emergencyPhone: editEmergencyPhone.trim(),
      });
      setEditModalOpen(false);
      await onRefreshProfile();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "No se pudo guardar el perfil.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenPschein = async () => {
    if (!pscheinDocument || isOpeningDocument) return;
    setActionError(undefined);
    setIsOpeningDocument(true);
    try {
      const filename = filenameFromUrlOrPath(pscheinDocument);
      if (!filename) throw new Error("No se pudo identificar el documento del perfil.");
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
    return () => { isMounted = false; };
  }, [onRefreshProfile]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Text style={styles.title}>Perfil</Text>
          <View style={styles.headerActions}>
            <Pressable
              style={({ pressed }) => [styles.iconButtonRound, pressed && styles.iconButtonRoundPressed]}
              onPress={handleOpenEdit}
              accessibilityRole="button"
              accessibilityLabel="Editar perfil"
            >
              {({ pressed }) => (
                <Ionicons name="pencil" size={18} color={pressed ? "#f97316" : "#ffffff"} />
              )}
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.iconButtonRound, pressed && styles.iconButtonRoundPressed]}
              onPress={() => { void onRefresh(); }}
              disabled={isRefreshing}
              accessibilityRole="button"
              accessibilityLabel="Refrescar perfil"
            >
              {({ pressed }) => (
                isRefreshing ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Ionicons name="refresh" size={20} color={pressed ? "#f97316" : "#ffffff"} />
                )
              )}
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void onRefresh()} />}
      >
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
            <View style={styles.avatarMeta}>
              <Text style={styles.avatarMetaLeft} numberOfLines={1}>{user.email ?? ""}</Text>
              <Text style={styles.avatarMetaRight} numberOfLines={1}>{user.employeeNumber ?? ""}</Text>
            </View>
          </View>

          <View style={[styles.fieldPair, styles.fieldPairFirst]}>
            <FieldCell label="Nombre" value={user.name} />
            <FieldCell label="Apellidos" value={user.lastName} />
          </View>
          <View style={styles.fieldPair}>
            <FieldCell label="Telefono" value={user.phone} emptyFallback="Sin telefono" />
            <FieldCell label="Tel. emergencia" value={user.emergencyPhone} emptyFallback="Sin tel." />
          </View>
          <View style={styles.fieldPair}>
            <FieldCell label="Rol" value={formatAmbulanceRole(user.ambulanceRole)} />
            <FieldCell label="Direccion" value={user.address} emptyFallback="Sin direccion" />
          </View>
        </View>

        <View style={[styles.card, styles.pscheinCard]}>
          <View style={styles.documentRow}>
            <View style={styles.pscheinInfo}>
              <Text style={styles.sectionTitle}>P-Schein</Text>
              <Text style={styles.pscheinExpiry}>
                {user.pscheinExpiry ? `Caduca: ${user.pscheinExpiry}` : "Caducidad pendiente"}
              </Text>
            </View>
            {pscheinDocument ? (
              <Pressable
                style={[styles.pscheinButton, isOpeningDocument && styles.openButtonDisabled]}
                onPress={() => void handleOpenPschein()}
                disabled={isOpeningDocument}
              >
                {isOpeningDocument ? (
                  <ActivityIndicator size="small" color="#ca8a04" />
                ) : (
                  <Ionicons name="eye-outline" size={22} color="#ca8a04" />
                )}
              </Pressable>
            ) : (
              <Text style={styles.emptyText}>Sin documento</Text>
            )}
          </View>
        </View>

        {actionError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{actionError}</Text>
          </View>
        ) : null}
      </ScrollView>

      <Modal
        visible={editModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar perfil</Text>
              <Pressable onPress={() => setEditModalOpen(false)} accessibilityRole="button">
                <Ionicons name="close" size={22} color="#334155" />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody}>
              <Text style={styles.sectionLabel}>Datos de contacto</Text>

              <Text style={styles.inputLabel}>Telefono</Text>
              <TextInput
                style={styles.input}
                value={editPhone}
                onChangeText={setEditPhone}
                placeholder="Sin telefono"
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
                autoCorrect={false}
              />

              <Text style={styles.inputLabel}>Direccion</Text>
              <TextInput
                style={styles.input}
                value={editAddress}
                onChangeText={setEditAddress}
                placeholder="Sin direccion"
                placeholderTextColor="#94a3b8"
                autoCorrect={false}
              />

              <Text style={styles.inputLabel}>Telefono de emergencia</Text>
              <TextInput
                style={styles.input}
                value={editEmergencyPhone}
                onChangeText={setEditEmergencyPhone}
                placeholder="Sin telefono de emergencia"
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
                autoCorrect={false}
              />

              <Text style={styles.sectionLabel}>Foto de perfil</Text>
              <View style={styles.pickRow}>
                <Pressable style={styles.pickButton} onPress={() => { void handlePickProfileImage("camera"); }}>
                  <Ionicons name="camera-outline" size={18} color="#0f172a" />
                  <Text style={styles.pickButtonText}>Camara</Text>
                </Pressable>
                <Pressable style={styles.pickButton} onPress={() => { void handlePickProfileImage("library"); }}>
                  <Ionicons name="image-outline" size={18} color="#0f172a" />
                  <Text style={styles.pickButtonText}>Galeria</Text>
                </Pressable>
              </View>
              {pendingProfileImage ? (
                <View style={styles.previewRow}>
                  <Image source={{ uri: pendingProfileImage.uri }} style={styles.previewThumb} />
                  <View style={styles.previewInfo}>
                    <Text style={styles.previewName} numberOfLines={1}>{pendingProfileImage.name}</Text>
                    <Pressable onPress={() => setPendingProfileImage(null)}>
                      <Text style={styles.previewRemove}>Quitar</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              <Text style={styles.sectionLabel}>Documento P-Schein</Text>
              <View style={styles.pickRow}>
                <Pressable style={styles.pickButton} onPress={() => { void handlePickDocument("camera"); }}>
                  <Ionicons name="camera-outline" size={18} color="#0f172a" />
                  <Text style={styles.pickButtonText}>Camara</Text>
                </Pressable>
                <Pressable style={styles.pickButton} onPress={() => { void handlePickDocument("library"); }}>
                  <Ionicons name="image-outline" size={18} color="#0f172a" />
                  <Text style={styles.pickButtonText}>Galeria</Text>
                </Pressable>
              </View>
              {pendingDocument ? (
                <View style={styles.previewRow}>
                  <Image source={{ uri: pendingDocument.uri }} style={styles.previewThumb} />
                  <View style={styles.previewInfo}>
                    <Text style={styles.previewName} numberOfLines={1}>{pendingDocument.name}</Text>
                    <Pressable onPress={() => setPendingDocument(null)}>
                      <Text style={styles.previewRemove}>Quitar</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              {saveError ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{saveError}</Text>
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable
                style={styles.cancelButton}
                onPress={() => setEditModalOpen(false)}
                disabled={isSaving}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
                onPress={() => { void handleSave(); }}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.saveButtonText}>Guardar</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: "#0f172a",
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#ffffff",
  },
  subtitle: {
    fontSize: 14,
    color: "#94a3b8",
  },
  iconButtonRound: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonRoundPressed: {
    borderColor: "#f97316",
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
    backgroundColor: "#0f172a",
    marginHorizontal: -14,
    marginTop: -14,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    marginBottom: 4,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#1e293b",
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarPlaceholderText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "600",
  },
  nameText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 16,
  },
  avatarMeta: {
    flexDirection: "row",
    alignSelf: "stretch",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 2,
  },
  avatarMetaLeft: {
    fontSize: 12,
    color: "#cbd5e1",
    flex: 1,
    minWidth: 0,
  },
  avatarMetaRight: {
    fontSize: 12,
    color: "#f97316",
    fontWeight: "700",
    textAlign: "right",
    flex: 1,
    minWidth: 0,
  },
  fieldPair: {
    flexDirection: "row",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 8,
  },
  fieldPairFirst: {
    borderTopWidth: 0,
    paddingTop: 0,
  },
  fieldPairItem: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  fieldSolo: {
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 8,
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
  documentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  pscheinCard: {
    borderColor: "#fde047",
  },
  pscheinInfo: {
    flex: 1,
    gap: 2,
  },
  pscheinExpiry: {
    fontSize: 12,
    color: "#92400e",
  },
  pscheinButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#fde047",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  openButtonDisabled: {
    opacity: 0.5,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  modalNote: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 18,
    marginBottom: 8,
  },
  modalBody: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    gap: 4,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
    marginTop: 16,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingBottom: 4,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
    marginTop: 8,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0f172a",
    backgroundColor: "#f8fafc",
  },
  pickRow: {
    flexDirection: "row",
    gap: 10,
  },
  pickButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingVertical: 10,
    backgroundColor: "#f8fafc",
  },
  pickButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 8,
    backgroundColor: "#f8fafc",
  },
  previewThumb: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: "#e2e8f0",
  },
  previewInfo: {
    flex: 1,
    gap: 4,
  },
  previewName: {
    fontSize: 12,
    color: "#334155",
  },
  previewRemove: {
    fontSize: 12,
    color: "#dc2626",
    fontWeight: "600",
  },
  modalFooter: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#475569",
    fontWeight: "600",
    fontSize: 14,
  },
  saveButton: {
    flex: 1,
    backgroundColor: "#f97316",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
});
