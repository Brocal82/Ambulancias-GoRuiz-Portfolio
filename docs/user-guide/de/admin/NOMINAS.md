# Lohnabrechnung (Administrator)

**Routen:** `/admin/payroll`, `/admin/payroll/nominas`, `/admin/payroll/month/:year/:month`  
**Erforderliches Modul:** `payroll`

---

## Was Sie tun können

- **PDF-Dateien** der Lohnabrechnung hochladen (eine oder mehrere).
- Das System versucht, jedes PDF einem Mitarbeiter **zuzuordnen** (nach Name oder anderen Kriterien).
- Nicht zugeordnete oder **konfliktbehaftete** Abrechnungen prüfen und manuell zuweisen.
- Eine fehlerhafte Abrechnung **ungültig machen** (für den Mitarbeiter nicht mehr sichtbar).

---

## Upload-Ablauf

1. Gehen Sie zu **Lohnabrechnung** → Upload-Bereich oder konkreter Monat.
2. Wählen Sie **Jahr und Monat** des Zeitraums.
3. Laden Sie die PDFs hoch.
4. Prüfen Sie den Zuordnungsstatus:
   - **Matched** — korrekt zugewiesen.
   - **Unmatched** — manuelle Zuweisung erforderlich.
   - **Conflict** — mehrere Kandidaten; wählen Sie den richtigen Mitarbeiter.

---

## Was der Mitarbeiter sieht

Nur seine eigenen aktiven Abrechnungen, in der App oder unter `/worker/payroll`.  
Anleitung: [Lohnabrechnung Mitarbeiter](../worker/NOMINAS.md).

---

## Sicherheit

Lohnabrechnungen sind sensible Dokumente. Sie werden nur über authentifizierten Zugang heruntergeladen (keine öffentlichen Links unter `/uploads`).

---

## Tipps

- Verwenden Sie einheitliche Dateinamen, wenn Ihr Prozess es erlaubt (erleichtert automatische Zuordnung).
- Machen Sie fehlerhafte Versionen ungültig, bevor Sie erneut hochladen, statt unkontrolliert zu duplizieren.
