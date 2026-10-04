# Testing - Backend

## Requisitos previos

Los tests de integración usan una base de datos MongoDB real. **Debes crear `.env.test`** antes de ejecutar tests.

### Configuración

Copia `.env.test.example` a `.env.test`:

| Entorno | Comando |
|---------|---------|
| macOS / Linux | `cp .env.test.example .env.test` |
| Windows PowerShell | `Copy-Item .env.test.example .env.test` |
| Windows CMD | `copy .env.test.example .env.test` |

Edita `.env.test` y configura:

- **`MONGODB_URI_TEST`** (obligatorio): Base de datos **dedicada para tests** (ej: `mongodb://localhost:27017/ambulancias_test`). Nunca uses la DB de desarrollo ni producción.
- **`JWT_SECRET`**: Secret para firmar tokens en tests.

> **Importante:** Se usa `MONGODB_URI_TEST` (no `MONGODB_URI`) para garantizar que los tests nunca toquen la DB de desarrollo. Cuando `NODE_ENV=test`, el backend usa exclusivamente `MONGODB_URI_TEST`.

MongoDB debe ejecutarse como **replica set** (algunos servicios usan transacciones). Ejemplo local con MongoDB 6:

```bash
mongod --port 27017 --replSet rs0 --dbpath <carpeta-datos>
mongosh --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"127.0.0.1:27017"}]})'
# .env.test → MONGODB_URI_TEST=mongodb://127.0.0.1:27017/ambulancias_test?replicaSet=rs0
```

### Ejecución

Suite completa (recomendado, ~3 min, 90 archivos / 893 tests):

```bash
npm run test:full
```

Un archivo concreto:

```bash
npx jest src/__tests__/<archivo>.test.ts
```

#### Por qué existe `test:full`

Con `jest --runInBand` (todos los archivos en el mismo proceso) la memoria crece unos 150 MB por archivo de test (se acumula entre archivos; causa exacta no investigada) y la suite completa termina con `JavaScript heap out of memory`. `test:full` sigue ejecutando los archivos **de uno en uno** (comparten la misma DB de test), pero en un worker que Jest reinicia cuando supera 1 GB (`--maxWorkers=1 --workerIdleMemoryLimit=1GB`). `--forceExit` cierra conexiones abiertas (Mongo, WebSocket) que algunos archivos dejan al terminar.

Alternativa equivalente si hiciera falta: ejecutar cada archivo en su propio proceso, p. ej. `for f in src/__tests__/*.test.ts; do npx jest --ci --forceExit "$f"; done`.

`npm test` (Jest por defecto, varios workers en paralelo sobre la misma DB) no está verificado para la suite completa; usar `test:full`.

### Si falta .env.test o MONGODB_URI_TEST

Si ejecutas `npm test` sin `.env.test`, o sin `MONGODB_URI_TEST` en `.env.test`, el proceso fallará con un mensaje claro. No se usa `.env` como fallback para evitar ejecuciones accidentales contra la DB incorrecta.
