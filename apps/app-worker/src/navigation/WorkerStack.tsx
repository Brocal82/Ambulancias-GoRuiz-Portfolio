import { createStackNavigator } from "@react-navigation/stack";

import { HomeScreen } from "../screens/HomeScreen";
import { AuthUser } from "../types/auth";
import { WorkerStackParamList } from "./types";

type Props = {
  user: AuthUser;
  onLogout: () => Promise<void>;
  onRefreshProfile: () => Promise<void>;
};

const Stack = createStackNavigator<WorkerStackParamList>();

export function WorkerStack({ user, onLogout, onRefreshProfile }: Props) {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Home"
        options={{ title: "Inicio trabajador" }}
      >
        {() => (
          <HomeScreen
            user={user}
            onLogout={onLogout}
            onRefreshProfile={onRefreshProfile}
            onOpenWorkday={() => undefined}
            onOpenAgenda={() => undefined}
            onOpenVacations={() => undefined}
            onOpenPraemien={() => undefined}
            hasWorkdayModule={false}
            hasAgendaModule={false}
            hasVacationModule={false}
            hasDocumentsModule={false}
            hasMessagesModule={false}
            hasPraemienModule={false}
            onOpenDocuments={() => undefined}
            onOpenMessages={() => undefined}
            onOpenProfile={() => undefined}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
