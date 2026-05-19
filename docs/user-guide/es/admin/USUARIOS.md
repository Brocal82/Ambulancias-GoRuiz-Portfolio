# Usuarios y trabajadores (admin)

**Rutas:** `/admin/users`, `/admin/user/:userId`  
**Módulo:** siempre disponible (gestión de usuarios de la empresa)

---

## Listado de usuarios

En **Usuarios** ves el personal de tu empresa: nombre, rol, estado, datos de contacto.

---

## Ficha de un trabajador

Al abrir un usuario (`/admin/user/:userId`) puedes:

- Ver y editar datos de perfil (según permisos).
- Gestionar **P-Schein** (documento y fecha de caducidad) si aplica a tu operativa.
- Subir documentación asociada al trabajador.
- Revisar rol en ambulancia (conductor, sanitario, ambos) si usas planificación por roles.

---

## Desactivar un usuario

Si un trabajador deja la empresa, **desactívalo** en lugar de borrarlo cuando sea posible. Un usuario inactivo:

- No puede iniciar sesión.
- Queda excluido de asignaciones futuras recomendadas.

---

## Relación con invitaciones

Los usuarios nuevos suelen entrar por [Invitación](./INVITACIONES.md). El listado de usuarios muestra quién ya completó el registro.

---

## Qué ven los trabajadores

Para explicar el uso de la app, usa las guías de [trabajador](../worker/README.md).
