# Erste Schritte (Administrator)

## Zugang zum Panel

1. Öffnen Sie die URL Ihres Unternehmens (von GoRuiz bereitgestellt).
2. Klicken Sie auf **Anmelden** (`/login`).
3. Geben Sie E-Mail und Passwort ein.
4. Nach erfolgreicher Anmeldung gelangen Sie zum Panel **`/admin`**.

Wenn Ihr Konto eine andere Rolle hat (Mechaniker, Werkstattleiter), ist die Startseite anders. Dieses Handbuch gilt nur für **Unternehmensadministratoren**.

---

## Sprache der Oberfläche

Im Panel können Sie die Sprache wechseln (Spanisch, Deutsch, Englisch), sofern der Sprachwähler verfügbar ist. Benutzerhandbücher gibt es in allen drei Sprachen unter `docs/user-guide/`.

---

## Mitarbeiter anlegen

Es gibt zwei übliche Wege:

### Einladung (empfohlen)

1. Gehen Sie zu **Einladungen** → `/admin/invitations`.
2. Erstellen Sie eine Einladung mit der E-Mail-Adresse des Mitarbeiters.
3. Kopieren Sie den Link oder senden Sie ihn per E-Mail.
4. Der Mitarbeiter öffnet den Link, schließt die Registrierung ab und ist mit Ihrem Unternehmen verknüpft.

Details: [Einladungen](./INVITACIONES.md).

### Vom Administrator angelegter Benutzer

Je nach Konfiguration kann der Administrator Benutzer unter **Benutzer** → `/admin/users` anlegen oder bearbeiten.

Details: [Benutzer](./USUARIOS.md).

---

## Empfohlene Reihenfolge der Einrichtung

1. **Kataloge** — Krankenhäuser, Ambulanzen, Teams (falls Module aktiv): [Kataloge](./CATALOGOS.md)
2. **Dienst-Vorlagen** — typische Wochenstruktur: [Dienste](./TURNOS.md)
3. **Woche erstellen** und **Personal zuweisen**
4. Mitarbeiter informieren, dass sie die **Mobile App** installieren und die Einladung annehmen sollen: [Mitarbeiter-Einstieg](../worker/INICIO.md)

---

## Grundlegende Sicherheit

- Teilen Sie Ihr Passwort nicht.
- Melden Sie sich an gemeinsam genutzten Geräten ab.
- Sensible Dokumente (Lohnabrechnungen, Krankmeldungen) werden sicher innerhalb der Anwendung geöffnet, nicht als öffentliche Links.
