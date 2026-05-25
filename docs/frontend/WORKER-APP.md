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
    navigation/     AuthStack, WorkerStack (legacy; no usados en producción)
    screens/        Todas las pantallas y WorkerTabsShell
    services/       Capa HTTP por dominio
    types/          auth.ts
    utils/          Helpers de jornada, archivos seguros, push, badge
  scripts/          validate-worker.mjs + tests lógicos
  App.tsx           Entry point — navegación por estado
  app.json          Config Expo
  eas.json          Config EAS Build
```

---

## Scripts

| Script | Descripción |
|--------|-------------|
| `npm --prefix apps/app-worker run typecheck` | `tsc --noEmit` |
| `npm --prefix apps/app-worker run validate` | typecheck + tests lógicos (gating, archivos, cierre) |
| `npm run typecheck:worker` | Atajo desde la raíz del monorepo |

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
| `agenda` | `WorkerAgendaScreen` | Sí (Agenda) | `scheduling` o `excel_planning` |
| `workday` | `WorkerWorkdayScreen` | Sí (Jornada) | `workday` |
| `vacations` | `WorkerVacationsScreen` | Sí (Vacaciones) | `vacation` |
| `sickLeaves` | `WorkerSickLeavesScreen` | Condicional | `sick_leaves` |
| `appointments` | `WorkerAppointmentsScreen` | Condicional | `appointments` |
| `praemien` | `WorkerPraemienScreen` | No (desde Home) | `praemien` |
| `documents` | `WorkerDocumentsScreen` | No (desde Home) | `payroll` y/o `documents` |
| `messages` | `WorkerMessagesScreen` | Sí (Mensajes + badge) | `messages` |
| `profile` | `WorkerProfileScreen` | Sí (Perfil) | Siempre |

### Pantallas overlay (no son tabs)

| Pantalla | Cuándo aparece |
|----------|---------------|
| `WorkerWorkdayClosureScreen` | Cierre de jornada (pantalla completa sobre Jornada) |
| `AdminBlockedScreen` | Rol distinto de worker tras login |
| `LoginScreen` | Sin sesión activa |

### Código legacy (`navigation/`)

`AuthStack.tsx` y `WorkerStack.tsx` definen stacks de React Navigation pero **no se importan en `App.tsx`**. Se mantienen compilables por compatibilidad; el flujo productivo es `WorkerTabsShell`.

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

**401:** `apiRequest` y rutas `fetch` manuales relevantes llaman a `notifyUnauthorizedIfStatus(401)` para limpiar sesión y volver a login.

---

## Feature gating (módulos)

`enabledModules` se carga desde `/companies/me` tras login.

- Tabs y módulos en `HomeScreen` se muestran condicionalmente.
- Push notifications: `resolvePushNavigationTarget()` ignora pantallas cuyo módulo esté desactivado.
- WebSocket de mensajes: solo conecta si `messages` está habilitado.
- Badge de no leídos: se pone a 0 si `messages` está desactivado.

### Documentos — tab inicial

`WorkerDocumentsScreen` elige tab inicial según módulos:

| Módulos activos | Tab por defecto |
|-----------------|-----------------|
| Solo `payroll` | Nóminas |
| Solo `documents` | Para confirmar |
| Ambos | Nóminas |

---

## Capa de servicios — `src/services/`

Todos los servicios usan el cliente HTTP de `http.ts` (no axios), salvo uploads multipart que usan `fetch` directo con `notifyUnauthorizedIfStatus` en error.

| Servicio | Dominio |
|----------|---------|
| `auth.ts` | Login |
| `users.ts` | Perfil y uploads |
| `company.ts` | Módulos habilitados |
| `workday.ts` | Jornada, viajes, cierre |
| `messages.ts` | Mensajes |
| `secureFiles.ts` | Apertura centralizada de adjuntos |
| `pushNotifications.ts` | Token Expo + historial |

---

## Archivos protegidos — `secureFiles.ts`

Política alineada con el backend:

| Tipo | Ruta |
|------|------|
| PDFs y tipos desconocidos | `GET /api/files/:filename` con Bearer token |
| Imágenes verificadas (jpg/png/webp) | Sondeo público de `/uploads` con comprobación MIME |

API central: `openSecureAttachment(url, meta?)`.

Usado en: nóminas, documentos de empresa, adjuntos de mensajes, P-Schein en perfil.

---

## WebSocket — solo app worker

Conexión persistente mientras la app está activa y el módulo `messages` está habilitado.

- Evento: `new_message` → actualiza badge + refresco en `WorkerMessagesScreen`
- **App state:** al pasar a background/inactive se cierra el socket y se pausa la reconexión; al volver a `active` se reconecta y refresca el badge

Ver `docs/frontend/WEBSOCKET.md` para arquitectura del servidor.

---

## Push notifications — Expo

1. `registerForPushNotifications()` tras login
2. `POST /api/notifications/register-token`
3. Backend envía push al crear mensajes
4. `WorkerTabsShell` escucha taps y navega con `resolvePushNavigationTarget`

Pantallas navegables: `agenda`, `messages`, `vacations`, `sickLeaves`, `appointments`, `workday`, `documents`, `praemien` (solo si el módulo está activo).

---

## Cierre de jornada (Workday)

`WorkerWorkdayClosureScreen` envía `POST /api/workday-summary` con:

- Datos de ambulancia, km inicial/final, checklist, O2
- **`trips`: solo `{ _id }`** — el backend recarga los viajes desde BD y rechaza snapshots obsoletos (409)

El cliente no debe enviar snapshots completos de viaje en el cierre final.

---

## Permisos de dispositivo

| Permiso | Cuándo se solicita |
|---------|-------------------|
| Notificaciones push | Primer login |
| Cámara / galería | Foto de perfil, P-Schein, averías |
| Almacenamiento (Android) | Descarga/compartir archivos |

---

## Smoke manual recomendado

- Login / logout / restauración de sesión
- Mensajes: WS + push + badge
- Nómina PDF y documento de empresa
- Cierre final de jornada
- Empresa solo documentos / solo nóminas
- Módulo `messages` desactivado
- Push desde background hacia tab correcto
