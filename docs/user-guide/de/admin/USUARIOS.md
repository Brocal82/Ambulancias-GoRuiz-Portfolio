# Benutzer und Mitarbeiter (Administrator)

**Routen:** `/admin/users`, `/admin/user/:userId`  
**Modul:** immer verfügbar (Verwaltung der Unternehmensbenutzer)

---

## Benutzerliste

Unter **Benutzer** sehen Sie das Personal Ihres Unternehmens: Name, Rolle, Status, Kontaktdaten.

---

## Mitarbeiterprofil

Beim Öffnen eines Benutzers (`/admin/user/:userId`) können Sie:

- Profildaten anzeigen und bearbeiten (je nach Berechtigungen).
- **P-Schein** verwalten (Dokument und Ablaufdatum), falls für Ihren Betrieb relevant.
- Zugehörige Dokumentation hochladen.
- Rolle in der Ambulanz prüfen (Fahrer, Sanitäter, beides), falls rollenbasierte Planung genutzt wird.

---

## Benutzer deaktivieren

Wenn ein Mitarbeiter das Unternehmen verlässt, **deaktivieren** Sie ihn, statt ihn zu löschen, wenn möglich. Ein inaktiver Benutzer:

- Kann sich nicht anmelden.
- Wird von künftigen Zuweisungen ausgeschlossen.

---

## Zusammenhang mit Einladungen

Neue Benutzer kommen meist über [Einladung](./INVITACIONES.md). In der Benutzerliste sehen Sie, wer die Registrierung abgeschlossen hat.

---

## Was Mitarbeiter sehen

Zur Erklärung der App-Nutzung nutzen Sie die [Mitarbeiter-Anleitungen](../worker/README.md).
