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

### Ejecución

```bash
npm test
```

### Si falta .env.test o MONGODB_URI_TEST

Si ejecutas `npm test` sin `.env.test`, o sin `MONGODB_URI_TEST` en `.env.test`, el proceso fallará con un mensaje claro. No se usa `.env` como fallback para evitar ejecuciones accidentales contra la DB incorrecta.
