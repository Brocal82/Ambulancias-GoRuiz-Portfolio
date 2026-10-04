# WebSocket y tiempo casi real

Documentación de la arquitectura de comunicación en tiempo real: servidor WebSocket, cliente móvil y alternativas web.

---

## Visión general

```
Backend WS (src/modules/notifications/ws-manager.ts)
         │
         │ ws://host/ws?token=<jwt>
         │
    ┌────┴────┐
    │  App    │  ← WebSocket activo (nuevo mensaje → badge + trigger)
    │ worker  │
    └─────────┘

    Frontend    ← Sin WebSocket. Polling + BroadcastChannel.
    web admin
```

El servidor WebSocket y el servidor Express comparten el **mismo puerto HTTP**. No hay un proceso separado.

---

## Servidor WebSocket — backend

Archivo: `src/modules/notifications/ws-manager.ts`

Inicializado en `src/index.ts` tras conectar MongoDB:

```ts
const httpServer = createServer(app);
setupWebSocketServer(httpServer);
httpServer.listen(env.PORT);
```

### Autenticación

La conexión WS se autentica por JWT en el query param `token`:

```
ws://host/ws?token=<jwt>
```

El servidor valida:
1. Firma JWT con `JWT_SECRET`
2. Rechaza tokens con `typ: "step_up"` (no son sesiones)
3. Busca el usuario en BD: debe existir y estar activo
4. Verifica `tokenVersion` contra `UserSessionState`

Conexiones con token inválido se cierran inmediatamente.

> **Limitación conocida:** la validación es asíncrona y el socket se registra al terminarla, después de que el cliente reciba `open`. Un evento emitido en ese intervalo no llega a ese socket. Ver [KNOWN-ISSUES.md](../KNOWN-ISSUES.md#websocket-ventana-de-registro-durante-la-autenticación).

### Mapa de conexiones

```ts
Map<userId, Set<WebSocket>>
```

Un usuario puede tener múltiples sockets abiertos (multi-dispositivo). `notifyUsers(userIds, event)` envía a todos los sockets abiertos de cada userId.

### Formato de mensaje

```json
{ "event": "<nombre_evento>" }
```

### Heartbeat y límites

- Ping/pong cada **30s** (`ws.ping()`); sockets sin respuesta se terminan.
- Máximo **5 conexiones** simultáneas por `userId` (las más antiguas se cierran con código 1008).

### Eventos emitidos actualmente

| Evento | Emisor | Descripción |
|--------|--------|-------------|
| `new_message` | `messages.service.ts` al crear mensaje | Notifica a todos los recipients del mensaje |

---

## Cliente WebSocket — app worker

Archivo: `apps/app-worker/src/screens/WorkerTabsShell.tsx`

### Conexión

```ts
const ws = new WebSocket(`${ENV.wsBaseUrl}?token=${encodeURIComponent(token)}`);
```

`ENV.wsBaseUrl` se deriva del `apiBaseUrl` reemplazando `http(s)` por `ws(s)` y eliminando `/api`.

### Ciclo de vida

- Se crea al montar `WorkerTabsShell` (usuario autenticado)
- `ws.onopen` — conexión establecida
- `ws.onmessage` — procesa evento
- `ws.onclose` / `ws.onerror` — reconexión exponencial (backoff hasta 30 s)
- Se destruye al desmontar (logout)

### Reconexión

```
1er intento:  1 s
2do intento:  2 s
3er intento:  4 s
...
Máximo:      30 s
```

### Manejo de eventos

```ts
ws.onmessage = (event) => {
  const msg = JSON.parse(String(event.data)) as { event?: string };

  if (msg.event === "new_message") {
    void refreshUnreadMessagesCount();   // actualiza badge
    setWsTrigger((prev) => prev + 1);   // trigger refresco en WorkerMessagesScreen
  }
};
```

---

## Frontend web admin — sin WebSocket

El frontend web admin **no establece conexión WebSocket** con el servidor. Usa dos mecanismos alternativos:

### 1. Polling periódico

Hooks como `useUnreadMessagesCount` (mensajes) consultan la API periódicamente:

- Cada **30 segundos** en background
- Al recuperar **foco de ventana** (`window.addEventListener("focus", ...)`)
- Al recuperar **visibilidad de página** (`document.addEventListener("visibilitychange", ...)`)

### 2. BroadcastChannel + CustomEvent (sincronización cross-tab)

Cuando una acción en un tab produce un cambio de datos, el módulo emite un evento. Otros tabs con el mismo módulo abierto se sincronizan sin refresh manual.

**Módulos con eventos cross-tab:**

| Módulo | Eventos emitidos |
|--------|-----------------|
| `messages` | `useMessagesChanged` — nuevo mensaje, leído, eliminado |
| `vacation` | `useVacationAvailabilityInvalidation` — cambio de estado de solicitud |
| `mechanics` | `useMechanicsIssuesChanged` — nueva avería, cambio de estado |
| `workday` | Cambio en jornadas |
| `sick` | Nueva baja o actualización |
| `appointments` | Nueva cita o cambio |
| `diensts` | Cambio en asignaciones de turno |
| `hospitals` | Cambio en catálogo |

Estos hooks no conectan al WS del servidor; operan solo dentro del navegador del usuario.

---

## Push notifications — Expo (app worker)

Complementario al WebSocket, las push notifications permiten notificar al worker cuando la app está en background o cerrada.

### Flujo

```
Backend: POST /api/messages (nuevo mensaje, solo admin)
    │
    ├─ notifyUsers([recipientIds], "new_message")   → WS evento único (sin cuerpo de chat)
    └─ sendPushNotification(pushTokens, payload)    → Expo Push API → dispositivo
```

**Contrato WS mensajes:** solo se emite el evento `new_message` a los IDs de destinatario tras un envío admin exitoso. No hay eventos de hilo, edición, ni escritura worker→admin. El cliente debe refrescar la bandeja (p. ej. `messages-changed` en web, refetch en app worker).

### Registro de token

```ts
// En AuthContext tras login:
registerForPushNotifications()
  → expo-notifications.getExpoPushTokenAsync()
  → POST /api/notifications/register-token { token, platform }

// En logout (app worker):
unregisterPushNotifications()
  → POST /api/notifications/unregister-token {}  // elimina todos los tokens del worker
```

Un usuario puede tener múltiples tokens (varios dispositivos). El backend almacena todos en `PushToken` y envía a todos. Si el mismo token físico se registra en otra cuenta, el registro anterior se elimina.

### Higiene operacional

- **Push stale tokens:** respuestas Expo `DeviceNotRegistered` / `InvalidCredentials` eliminan el token en BD.
- **WebSocket heartbeat:** el servidor envía `ping` cada 30s; conexiones sin `pong` se terminan. Máximo 5 sockets por usuario.
- **Module gating (defense-in-depth):** los dominios pueden pasar `moduleKey` a `sendPushNotification` para omitir usuarios cuya empresa no tiene el módulo activo (p. ej. mensajes).

### Estructura del payload push

```json
{
  "title": "Nuevo mensaje",
  "body": "Tienes un mensaje nuevo",
  "data": {
    "screen": "messages",
    "type": "message_received",
    "resourceId": "<messageId>",
    "messageId": "<messageId>"
  }
}
```

Todos los valores en `data` son strings (requisito Expo). Campos normalizados: `screen`, `type`, `resourceId`; metadatos adicionales (p. ej. `date`, `status`) se incluyen como strings.

El campo `data.screen` determina a qué tab navega la app al abrir la notificación.

**Pantallas navegables desde push:**

| `data.screen` | Tab destino |
|---------------|-------------|
| `messages` | `WorkerMessagesScreen` |
| `agenda` | `WorkerAgendaScreen` |
| `vacations` | `WorkerVacationsScreen` |
| `sickLeaves` | `WorkerSickLeavesScreen` |
| `appointments` | `WorkerAppointmentsScreen` |
| `workday` | `WorkerWorkdayScreen` |

---

## Resumen de capacidades por cliente

| Capacidad | App worker | Frontend web |
|-----------|-----------|--------------|
| WebSocket activo | Sí (`/ws?token=`) | No |
| Push notifications | Sí (Expo) | No |
| Polling periódico | Sí (20s fallback cuando messages activo) | Sí (30s + focus) |
| BroadcastChannel cross-tab | No aplica | Sí |
| Evento `new_message` en tiempo real | Sí (WS) | Solo al refrescar |

---

## Añadir un nuevo evento WS

Para emitir un nuevo evento desde el backend a los clientes móviles:

**Backend:** llamar a `notifyUsers(userIds, "nombre_evento")` en el servicio correspondiente.

**App worker:** añadir el handler en `WorkerTabsShell.tsx`:
```ts
if (msg.event === "nombre_evento") {
  // actualizar estado / trigger refresco
}
```

**Web admin:** no hay cliente WS — si se necesita reactividad, añadir polling al hook del módulo o usar el patrón BroadcastChannel existente.
