import * as SecureStore from "expo-secure-store";

const SESSION_TOKEN_KEY = "goruiz_session_token";
const SESSION_USER_KEY = "goruiz_session_user";

export async function saveSession(token: string, userJson: string): Promise<void> {
  await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
  await SecureStore.setItemAsync(SESSION_USER_KEY, userJson);
}

export async function getStoredSession(): Promise<{
  token: string | null;
  userJson: string | null;
}> {
  const [token, userJson] = await Promise.all([
    SecureStore.getItemAsync(SESSION_TOKEN_KEY),
    SecureStore.getItemAsync(SESSION_USER_KEY),
  ]);
  return { token, userJson };
}

export async function clearStoredSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(SESSION_TOKEN_KEY),
    SecureStore.deleteItemAsync(SESSION_USER_KEY),
  ]);
}
