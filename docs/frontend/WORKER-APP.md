# Worker App — Expo

Documentación de la aplicación móvil para trabajadores. Stack: Expo 54, React Native 0.81, TypeScript.

---

## Propósito

La app worker es la interfaz exclusiva para trabajadores (`role: "worker"`). Los admins que intenten acceder ven `AdminBlockedScreen` y no pueden usar la app.

---

## Estructura de directorios

```
apps/app-worker/
  src/
    auth/           AuthContext (login, logout, sesión, push tokens)
    config/         env.ts — URLs de API y WebSocket
    navigation/     AuthStack, WorkerStack (presentes pero no usados en producción)
    screens/        Todas las pantallas y WorkerTabsShell
    services/       Capa HTTP por dominio (17 archivos)
    types/          auth.ts
    utils/          Helpers de jornada, viajes y validadores
  App.tsx           Entry point — navegación por estado
  app.json          Config Expo
  eas.json          Config EAS Build
```

---

## Navegación

La app **no usa React Navigation** para el flujo principal. La navegación se gestiona con estado local en `WorkerTabsShell` (tab activo) y en `App.tsx` (pantalla raíz).

### Flujo de `App.tsx`

```
Hidratación (splash)
       │
       ▼
  ¿Autenticado?
  ┌────────────────────────────────────┐
  │ No → LoginScreen                  │
  │ Sí + role !== "worker"            │
  │      → AdminBlockedScreen         │
  │ Sí + role === "worker"            │
  │      → WorkerTabsShell            │
  └────────────────────────────────────┘
```

### Tabs — `WorkerTabsShell`

Barra inferior + estado `activeTab`. Los tabs condicionales solo aparecen si el módulo está habilitado para la empresa.

| Tab key | Pantalla | Barra inferior | Condición |
|---------|----------|---------------|-----------|
| `home` | `HomeScreen` | Sí (Inicio) | Siempre |
| `agenda` | `WorkerAgendaScreen` | Sí (Agenda) | Siempre |
| `workday` | `WorkerWorkdayScreen` | Sí (Jornada) | `enabledModules.includes("workday")` |
| `vacations` | `WorkerVacationsScreen` | Sí (Vacaciones) | `enabledModules.includes("vacation")` |
| `sickLeaves` | `WorkerSickLeavesScreen` | Condicional | `enabledModules.includes("sick_leaves")` |
| `appointments` | `WorkerAppointmentsScreen` | Condicional | `enabledModules.includes("appointments")` |
| `praemien` | `WorkerPraemienScreen` | No (desde Home) | `enabledModules.includes("praemien")` |
| `documents` | `WorkerDocumentsScreen` | No (desde Home) | Siempre |
| `messages` | `WorkerMessagesScreen` | Sí (Mensajes + badge) | Siempre |
| `profile` | `WorkerProfileScreen` | Sí (Perfil) | Siempre |

### Pantallas overlay (no son tabs)

| Pantalla | Cuándo aparece |
|----------|---------------|
| `WorkerWorkdayClosureScreen` | Cierre de jornada (pantalla completa sobre Jornada) |
| `AdminBlockedScreen` | Rol distinto de worker tras login |
| `LoginScreen` | Sin sesión activa |

### Código no usado (`navigation/`)

`AuthStack.tsx` y `WorkerStack.tsx` definen stacks de React Navigation pero **no se importan en `App.tsx`**. Son código legacy del proceso de migración a la navegación por estado actual.

---

## Autenticación — `src/auth/AuthContext.tsx`

| Estado | Descripción |
|--------|-------------|
| `isAuthenticated` | Boolean — hay sesión activa |
| `user` | Datos del usuario autenticado |
| `token` | JWT activo |
| `enabledModules` | Módulos habilitados de la empresa |
| `scheduleSource` | Fuente de turnos: `diensts` o `excelPlanning` |
| `authError` | Mensaje de error de login |

**Ciclo de sesión:**
1. Inicio: carga sesión desde `expo-secure-store` (token cifrado)
2. Login: `POST /users/login` → guarda token + user
3. Tras login: `GET /companies/me` → `enabledModules` + `praemienMode`
4. Tras login: `registerForPushNotifications()` → registra token Expo en el backend
5. Logout: limpia `expo-secure-store` + estado

---

## Capa de servicios — `src/services/`

Todos los servicios usan el cliente HTTP de `http.ts` (no axios). Cada servicio encapsula las llamadas a un dominio del backend.

| Servicio | Dominio |
|----------|---------|
| `auth.ts` | Login (`POST /users/login`) |
| `users.ts` | Perfil de usuario |
| `company.ts` | Módulos habilitados y praemien config |
| `diensts.ts` | Turnos y agenda |
| `excelPlanning.ts` | Planificación Excel |
| `workday.ts` | Jornada activa, asignaciones, viajes |
| `vacations.ts` | Solicitudes de vacaciones |
| `sickLeaves.ts` | Bajas médicas |
| `appointments.ts` | Citas |
| `messages.ts` | Mensajes del trabajador |
| `praemien.ts` | Primas |
| `documents.ts` | Documentos de empresa |
| `payroll.ts` | Nóminas |
| `ambulances.ts` | Ambulancias (selección en jornada) |
| `mechanics.ts` | Reporte de averías |
| `secureFiles.ts` | Descarga y compartir archivos protegidos (`/api/files/:filename`) |
| `pushNotifications.ts` | Registro/eliminación de token Expo + historial |

### Cliente HTTP — `http.ts`

- `fetch` nativo (no axios)
- Añade `Authorization: Bearer <token>` en cada request
- Timeout configurable
- En 401: limpia sesión y vuelve a `LoginScreen`

---

## Sesión segura — `sessionStorage.ts`

Usa `expo-secure-store` para guardar el JWT y datos de sesión. El token se cifra en el almacenamiento seguro del dispositivo (Keychain en iOS, Keystore en Android).

**No usar** `AsyncStorage` para el token JWT — `expo-secure-store` ya está en uso.

---

## Configuración — `config/env.ts`

```ts
ENV.apiBaseUrl   // URL base API REST (ej: https://api.goruiz.com/api)
ENV.wsBaseUrl    // URL WebSocket (ej: wss://api.goruiz.com/ws)
```

La URL WebSocket se deriva del `apiBaseUrl`: reemplaza `http(s)` por `ws(s)` y elimina el path `/api`.

Variables de entorno Expo: `EXPO_PUBLIC_API_URL`.

---

## WebSocket — solo app worker

La app worker mantiene una conexión WebSocket persistente durante la sesión. Ver `docs/frontend/WEBSOCKET.md` para arquitectura completa.

Evento soportado actualmente: `new_message` → actualiza badge de mensajes sin leídos + trigger de refresco en `WorkerMessagesScreen`.

---

## Push notifications — Expo

1. `registerForPushNotifications()` en `AuthContext` tras login exitoso
2. `POST /api/notifications/register-token` con token Expo del dispositivo
3. Backend usa `sendPushNotification()` (Expo SDK) al crear mensajes nuevos
4. La app escucha notificaciones en `WorkerTabsShell`:
   - Con la app en primer plano: navega al tab según `data.screen`
   - En background: la notificación del sistema abre la app en la pantalla correcta

Pantallas navegables desde push: `agenda`, `messages`, `vacations`, `sickLeaves`, `appointments`, `workday`.

---

## Descarga de archivos protegidos

`src/services/secureFiles.ts` llama a `GET /api/files/:filename` con el token en cabecera, recibe el blob y usa `expo-file-system` + `expo-sharing` para compartir o visualizar el archivo.

Aplica a: PDFs de nóminas, documentos de empresa, adjuntos de bajas médicas.

---

## Permisos de dispositivo

| Permiso | Cuándo se solicita |
|---------|-------------------|
| Notificaciones push | Primer login |
| Cámara / galería | Subida de foto de perfil o P-Schein (`expo-image-picker`) |
| Almacenamiento (Android) | Descarga/compartir archivos |

---

## Feature gating en la app

`enabledModules` se carga desde `/companies/me` tras login. Los tabs y secciones de `HomeScreen` se muestran condicionalmente según los módulos habilitados de la empresa del trabajador.

Si la empresa desactiva un módulo mientras el worker tiene la app abierta, el tab desaparece en el próximo refresco de sesión.
