# Getting started (administrator)

## Accessing the panel

1. Open your company's URL (provided by GoRuiz).
2. Click **Sign in** (`/login`).
3. Enter your email and password.
4. After a successful login, you will reach the **`/admin`** panel.

If your account has a different role (mechanic, head mechanic), the home page will be different. This manual is only for **company administrators**.

---

## Interface language

In the panel you can change the language (Spanish, German, English) if the selector is available. User guides are available in all three languages in `docs/user-guide/`.

---

## Onboarding workers

There are two common approaches:

### Invitation (recommended)

1. Go to **Invitations** → `/admin/invitations`.
2. Create an invitation with the worker's email address.
3. Copy the link or send it by email.
4. The worker opens the link, completes registration, and is linked to your company.

Details: [Invitations](./INVITACIONES.md).

### User created by admin

Depending on configuration, the admin can create or edit users under **Users** → `/admin/users`.

Details: [Users](./USUARIOS.md).

---

## Recommended setup order

1. **Catalogs** — hospitals, ambulances, teams (if modules are active): [Catalogs](./CATALOGOS.md)
2. **Shift templates** — typical weekly structure: [Shifts](./TURNOS.md)
3. **Generate the week** and **assign** staff
4. Tell workers to install the **mobile app** and accept the invitation: [Worker getting started](../worker/INICIO.md)

---

## Basic security

- Do not share your password.
- Sign out on shared devices.
- Sensitive documents (payroll, sick leave) are opened securely inside the application, not as public links.
