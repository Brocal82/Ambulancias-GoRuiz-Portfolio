# Arbeitstage prüfen (Administrator)

**Route:** `/admin/summaries`  
**Erforderliches Modul:** `workday`

---

## Was ein Arbeitstag ist

Wenn ein Mitarbeiter seinen operativen Tag erfasst, registriert er **Fahrten** (Start, Krankenhaus, Ambulanz, Abschluss). Das System fasst dies in einer **Arbeitstags-Zusammenfassung** zusammen, die der Administrator prüfen kann.

Mitarbeiter-Anleitung: [Arbeitstag](../worker/JORNADA.md).

---

## Was Sie tun können

- Arbeitstage **zur Prüfung ausstehend** einsehen.
- Stunden, Fahrten und erfasste Daten prüfen.
- Als **geprüft** markieren.
- **Endgültigen Abschluss** durchführen, wenn Ihr Unternehmensprozess es verlangt (kein zweiter Endabschluss am selben Tag für denselben Dienst).

---

## Empfohlener Ablauf

1. Mitarbeiter schließt Fahrten in der App ab.
2. Zusammenfassung erscheint im Status ausstehend.
3. Administrator prüft Übereinstimmung mit zugewiesenem Dienst und internen Vorgaben.
4. Administrator prüft und schließt ggf. endgültig ab.
5. Geprüfte Stunden fließen in **Prämien** (automatischer Modus) → [Prämien](./PRIMAS.md).

---

## Häufige Vorkommnisse

| Situation | Maßnahme |
|-----------|----------|
| Arbeitstag vom Mitarbeiter nicht abgeschlossen | Mitarbeiter kontaktieren; [Arbeitstag](../worker/JORNADA.md) prüfen |
| Falsche Stunden | Korrektur nach interner Richtlinie vor endgültigem Abschluss abstimmen |
| Arbeitstag erscheint nicht | Modul `workday`, Dienstzuweisung an diesem Tag und korrekte App-Nutzung prüfen |
