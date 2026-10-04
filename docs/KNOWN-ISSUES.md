# Deuda técnica y limitaciones conocidas

Estado al archivar el proyecto (octubre 2026). Todo lo listado aquí está identificado y es
conocido; nada de ello impide compilar, arrancar ni ejecutar los tests.

---

## Backend

### WebSocket: ventana de registro durante la autenticación

`src/modules/notifications/ws-manager.ts` acepta la conexión, autentica el JWT de forma
asíncrona (`authenticateWsToken`, consultas a MongoDB) y **solo después** registra el socket en
el mapa de clientes. El cliente recibe `open` antes de que termine ese registro.

- **Efecto:** un evento emitido en esos milisegundos no se entrega a ese socket.
- **Impacto:** bajo. Los mensajes solo indican "refresca estos datos" (`{ event }`); un evento
  perdido no corrompe datos, pero la pantalla afectada no se actualiza hasta el siguiente evento,
  una recarga o navegación del usuario. Los clientes (`useWebSocketSync.ts` en web,
  `WorkerTabsShell.tsx` en móvil) **no** recargan datos al reconectar.
- **Tests:** `ws-realtime.integration.test.ts` espera explícitamente al registro en servidor
  (`__wsTestHooks.getClientCount`) antes de emitir.
- **Posible solución futura:** autenticar en el evento `upgrade` del servidor HTTP (antes de
  completar el handshake) o registrar el socket antes de la autenticación y descartarlo si falla.

### Jest: crecimiento de memoria en la suite completa

Con `--runInBand` la memoria crece ~150 MB por archivo y la suite completa termina en
`JavaScript heap out of memory`. Usar `npm run test:full` (ver `ambulancias-goruiz-backend/TESTING.md`).
Causa raíz no investigada.

### Tests requieren MongoDB en replica set

Algunos servicios usan transacciones. Ver `ambulancias-goruiz-backend/TESTING.md`.

---

## Frontend (web admin)

### Lint: 138 errores / 29 avisos preexistentes

`npm --prefix ambulancias-goruiz-frontend run lint` funciona pero no pasa. Desglose:

| Regla | Nº |
|-------|----|
| `@typescript-eslint/no-explicit-any` | 113 |
| `react-hooks/exhaustive-deps` | 11 |
| Directivas `eslint-disable` sin uso | 11 |
| `react-hooks/rules-of-hooks` | 10 |
| `@typescript-eslint/no-unused-vars` | 7 |
| `react-refresh/only-export-components` | 7 |
| `@typescript-eslint/no-unused-expressions` | 4 |
| `@typescript-eslint/no-empty-object-type` | 3 |
| `no-irregular-whitespace` | 1 |

El lint no se ejecuta en CI.

### Hooks tras un `return` anticipado (latente, sin fallo actual)

Los 10 avisos `rules-of-hooks` restantes están en `EditDienstTemplateModal.tsx` y
`AssignmentModal.tsx`: ambos hacen `if (!isOpen) return null;` antes de sus hooks. Hoy no falla
porque todos los padres los montan condicionalmente (`{abierto && <Modal isOpen … />}`), así que
`isOpen` nunca cambia dentro de una misma instancia. Si se montaran siempre y se alternara
`isOpen`, React lanzaría "Rendered fewer/more hooks than expected".

### Dependencia implícita de `@types/node`

`npm run build` (`tsc -b`) typechequea `vitest.config.ts`, que usa `node:path`/`node:url`, pero
el `package.json` del frontend no declara `@types/node`: se resuelve desde el `node_modules` de la
raíz (instalado por `npm ci` en la raíz, como hace el CI). Sin esa instalación previa el build
falla. Documentado en `docs/RECOVERY.md` (A.3); la corrección sería declarar `@types/node` como
devDependency del frontend.

### Internacionalización incompleta (ES / DE / EN)

La interfaz está traducida con i18next a español, alemán e inglés, pero quedan textos fijos en
español que no cambian al seleccionar otro idioma:

- `src/layouts/AdminSidebarLayout.tsx`: las 21 etiquetas y títulos de sección de la barra lateral
  del admin (`Gestión`, `Usuarios`, `Equipos`, `Planificación`, …).
- `src/modules/companies/pages/SuperadminCompaniesList.tsx`: cabeceras de la tabla de empresas
  (`Nombre`, `Dominio`, `Módulos`, `Trabajadores`, …).
- `src/modules/diensts/components/OperationalHealthBadge.tsx`: "Sin escanear" / "Escanear".
- Probablemente otros textos sueltos: no se ha hecho una auditoría completa.

Además, el selector de idioma muestra una **bandera turca decorativa** sin traducción asociada
(`src/components/ui/LanguageSwitcher.tsx`, marcada en el código como "visual únicamente").

Por eso las capturas del README usan la interfaz en español, que es la única coherente al 100 %.

### Recursos externos en tiempo de ejecución

- Avatar por defecto desde `cdn-icons-png.flaticon.com` (4 layouts/páginas).
- Swagger UI de `/api/docs` cargado desde `unpkg.com/swagger-ui-dist@5` (versión no fijada).

Si esos CDN cambian o desaparecen, el avatar por defecto o la UI de `/api/docs` dejan de verse;
`/api/docs.json` sigue funcionando.

---

## App móvil (Expo)

- `expo-doctor`: `react-native-worklets` (peer de `react-native-reanimated`) no está declarado
  directamente (se instala de forma transitiva) y 3 paquetes difieren ligeramente de las
  versiones esperadas por Expo SDK 54.
- El build nativo (Gradle/EAS) no se verificó durante el archivado; sí typecheck, `validate` y
  `expo export --platform android`. `android/` se genera con `expo prebuild` y no está en Git.
- Las notificaciones push dependen de Expo Push + Firebase Cloud Messaging (credenciales fuera del
  repositorio).

---

## Plataforma / herramientas

- **Node 20** está fuera de soporte desde abril de 2026. Versión verificada: `20.20.2` (`.nvmrc`).
  Node 24 compila, pasa typecheck y tests de frontend, pero la suite backend no se verificó con él.
- **URL de despliegue histórica:** `ambulancias-goruiz-frontend/public/_redirects` sigue
  apuntando al backend alojado históricamente, que se retira al archivar. Hay que sustituirla al volver a desplegar
  (ver `docs/RECOVERY.md`, Part B).
