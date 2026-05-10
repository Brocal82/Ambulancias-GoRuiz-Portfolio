import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { apiRequest } from "./http";

export async function registerForPushNotifications(): Promise<void> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") return;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId as string | undefined;

  let tokenData: Awaited<ReturnType<typeof Notifications.getExpoPushTokenAsync>>;
  try {
    tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
  } catch (err) {
    console.warn("[push] Error al obtener token:", err);
    return;
  }

  const platform = Platform.OS === "ios" ? "ios" : "android";

  await apiRequest<void>("/notifications/register-token", {
    method: "POST",
    requiresAuth: true,
    body: JSON.stringify({ token: tokenData.data, platform }),
  });
}
