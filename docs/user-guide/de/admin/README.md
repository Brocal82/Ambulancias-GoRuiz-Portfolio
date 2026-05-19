# Administratorhandbuch

Nutzung des **Web-Administrationspanels** (Rolle `admin`). Nach der Anmeldung ist die Startseite in der Regel `/admin`.

---

## Bevor Sie beginnen

1. [Erste Schritte](./PRIMEROS-PASOS.md) — Zugang, Einladungen, Sprache
2. Prüfen Sie, welche Module für Ihr Unternehmen aktiv sind (Seitenmenü). Es werden nur die gebuchten Module angezeigt.

---

## Anleitungen nach Modul

| Anleitung | Route in der App | Wann verwenden |
|-----------|------------------|----------------|
| [Erste Schritte](./PRIMEROS-PASOS.md) | `/login`, `/admin/invitations` | Benutzer anlegen und Erstkonfiguration |
| [Benutzer](./USUARIOS.md) | `/admin/users`, `/admin/user/:id` | Mitarbeiter und Profile verwalten |
| [Einladungen](./INVITACIONES.md) | `/admin/invitations` | Registrierungslinks versenden |
| [Dienste (Planung)](./TURNOS.md) | `/admin/diensts`, `/admin/dienst-templates` | Vorlagen, Wochen und Zuweisungen |
| [Excel-Planung](./PLANIFICACION-EXCEL.md) | `/admin/excel-planning` | Plan aus Excel importieren (falls aktiv) |
| [Kataloge](./CATALOGOS.md) | Krankenhäuser, Ambulanzen, Teams | Stammdaten |
| [Arbeitstage](./JORNADA.md) | `/admin/summaries` | Arbeitstage prüfen und abschließen |
| [Urlaub](./VACACIONES.md) | `/admin/vacations` | Daten genehmigen oder vorschlagen |
| [Krankmeldungen](./BAJAS.md) | `/admin/sick-leaves` | Krankmeldungen verwalten |
| [Nachrichten](./MENSAJES.md) | `/admin/messages` | Interne Kommunikation |
| [Termine](./CITAS.md) | `/admin/appointments` | Termine mit Mitarbeitern |
| [Mechanik](./MECANICA.md) | `/admin/mechanics` | Störungen und Arbeitsaufträge |
| [Prämien](./PRIMAS.md) | `/admin/praemien` | Prämien prüfen und bestätigen |
| [Lohnabrechnung](./NOMINAS.md) | `/admin/payroll` | Lohnabrechnungs-PDFs hochladen und zuweisen |
| [Dokumente](./DOCUMENTOS.md) | `/admin` (Modul Dokumente) | Dokumente veröffentlichen und zustellen |

---

## Anleitungen für Ihr Team (Mitarbeiter)

Als Administrator sollten Sie die Mitarbeitererfahrung kennen:

| Anleitung | Link |
|-----------|------|
| App-Einstieg | [../worker/INICIO.md](../worker/INICIO.md) |
| Agenda und Dienste | [../worker/AGENDA.md](../worker/AGENDA.md) |
| Täglicher Arbeitstag | [../worker/JORNADA.md](../worker/JORNADA.md) |
| Alle Mitarbeiter-Anleitungen | [../worker/README.md](../worker/README.md) |

---

## Profil und Abmeldung

- **Profil:** `/profile` — persönliche Daten, P-Schein, Foto (je nach Konfiguration).
- **Abmelden:** Benutzermenü. Die Sitzung bleibt im Browser gespeichert, bis Sie den Tab schließen oder das Token abläuft.

---

## Häufige Probleme

| Symptom | Was prüfen |
|---------|------------|
| Ein Menüpunkt aus dem Handbuch fehlt | Modul für Ihr Unternehmen nicht aktiv |
| „Modul nicht aktiviert“ | Gleicher Fall; GoRuiz kontaktieren |
| Mitarbeiter kann sich nicht anmelden | Benutzer aktiv, Einladung angenommen, Zugangsdaten korrekt |
| Ein Dienst erscheint nicht in der App | Woche erstellt, Zuweisung gespeichert, Modul `scheduling` aktiv |
