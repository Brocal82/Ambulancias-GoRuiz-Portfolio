import { createStackNavigator } from "@react-navigation/stack";

import { LoginScreen } from "../screens/LoginScreen";
import { AuthStackParamList } from "./types";

type Props = {
  onLogin: (credentials: { email: string; password: string }) => Promise<void>;
  authError?: string;
};

const Stack = createStackNavigator<AuthStackParamList>();

export function AuthStack({ onLogin, authError }: Props) {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Login" options={{ headerShown: false }}>
        {() => <LoginScreen onLogin={onLogin} errorMessage={authError} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
