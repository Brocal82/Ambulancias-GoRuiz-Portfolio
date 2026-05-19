# Primeros pasos (administrador)

## Acceso al panel

1. Abre la URL de tu empresa (la que te haya facilitado GoRuiz).
2. Pulsa **Iniciar sesión** (`/login`).
3. Introduce email y contraseña.
4. Tras un login correcto irás al panel **`/admin`**.

Si tu cuenta es de otro rol (mecánico, jefe de mecánicos), la página de inicio será distinta. Este manual es solo para **administradores de empresa**.

---

## Idioma de la interfaz

En el panel puedes cambiar el idioma (español, alemán, inglés) si está disponible en el selector. Las guías de usuario existen en los tres idiomas en `docs/user-guide/`.

---

## Dar de alta trabajadores

Hay dos formas habituales:

### Invitación (recomendado)

1. Ve a **Invitaciones** → `/admin/invitations`.
2. Crea una invitación con el email del trabajador.
3. Copia el enlace o envíalo por correo.
4. El trabajador abre el enlace, completa el registro y queda vinculado a tu empresa.

Detalle: [Invitaciones](./INVITACIONES.md).

### Usuario creado por admin

Según la configuración, el admin puede crear o editar usuarios en **Usuarios** → `/admin/users`.

Detalle: [Usuarios](./USUARIOS.md).

---

## Orden recomendado de configuración

1. **Catálogos** — hospitales, ambulancias, equipos (si los módulos están activos): [Catálogos](./CATALOGOS.md)
2. **Plantillas de turno** — estructura semanal tipo: [Turnos](./TURNOS.md)
3. **Generar semana** y **asignar** personal
4. Comunicar a los trabajadores que instalen la **app móvil** y acepten la invitación: [Inicio trabajador](../worker/INICIO.md)

---

## Seguridad básica

- No compartas tu contraseña.
- Cierra sesión en equipos compartidos.
- Los documentos sensibles (nóminas, bajas) se abren de forma segura dentro de la aplicación, no como enlaces públicos.
