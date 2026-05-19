# Prämien (Administrator)

**Route:** `/admin/praemien`  
**Erforderliches Modul:** `praemien`

---

## Unternehmensmodi

Ihr Unternehmen kann in einem dieser Modi sein:

| Modus | Verhalten |
|-------|-----------|
| **Automatisch** | Das System berechnet Prämien aus **geprüften** Arbeitstagen. |
| **Manuell** | Der Administrator trägt **täglich** Beträge pro Mitarbeiter ein. |

Den Modus legt die Unternehmenskonfiguration fest (GoRuiz kontaktieren, wenn unsicher).

---

## Automatischer Modus

1. Stellen Sie sicher, dass die **Arbeitstage** des Monats geprüft sind → [Arbeitstag](./JORNADA.md).
2. Öffnen Sie **Prämien** und wählen Sie Jahr/Monat.
3. Prüfen Sie erzeugte Entwürfe (Stunden, Betrag).
4. **Bestätigen** Sie die Prämie des Mitarbeiters oder des Monats.
5. Als **bezahlt** markieren, wenn ausgezahlt (je nach internem Prozess).

---

## Manueller Modus

1. Öffnen Sie den Bereich **tägliche Einträge** (manual daily).
2. Tragen Sie pro Mitarbeiter und Arbeitstag den vereinbarten Betrag ein.
3. Am Monatsende Gesamtsumme prüfen und wie im automatischen Modus bestätigen/auszahlen.

---

## Was der Mitarbeiter sieht

In der App kann er bestätigte oder bezahlte Prämien einsehen (Register oder Zugang über Start je nach Design).  
Anleitung: [Prämien Mitarbeiter](../worker/PRIMAS.md).

---

## Häufige Fehler

| Problem | Wahrscheinliche Ursache |
|---------|-------------------------|
| Prämie ist null | Arbeitstage nicht geprüft oder Monat ohne Einträge |
| Modul erscheint nicht | `praemien` für das Unternehmen nicht aktiv |
| Veraltete Daten | Moduswechsel mit zukünftigem Gültigkeitsdatum |
