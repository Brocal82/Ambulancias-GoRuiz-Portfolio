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

- `MONGODB_URI`: Base de datos **dedicada para tests** (ej: `ambulancias_test`). No uses la DB de desarrollo ni producción.
- `JWT_SECRET`: Secret para firmar tokens en tests.

### Ejecución

```bash
npm test
```

### Si falta .env.test

Si ejecutas `npm test` sin `.env.test`, el proceso fallará con un mensaje claro. No se usa `.env` como fallback para evitar ejecuciones accidentales contra la DB incorrecta.
