# Kataloge: Krankenhäuser, Ambulanzen und Teams (Administrator)

Diese Stammdaten speisen Dienste, Arbeitstage und Mechanik.

---

## Krankenhäuser

**Route:** `/admin/hospitals`  
**Modul:** `hospitals`

- Krankenhäuser anlegen, bearbeiten und entfernen.
- Mitarbeiter wählen sie bei der Erfassung von **Fahrten** im Arbeitstag.

---

## Ambulanzen

**Route:** `/admin/ambulances`  
**Modul:** `ambulances`

- Kennzeichen, Ambulanznummer, Identifikationsdaten.
- Werden in **Diensten** und **Fahrten** zugewiesen.

---

## Teams

**Route:** `/admin/teams`  
**Modul:** `teams`

- Paare oder Gruppen definieren (Fahrer + Sanitäter).
- Rotationsmodi (rotierend, fest, manuell) je nach Unternehmenskonfiguration.
- Optional: feste Ambulanz des Teams.

Massenzuweisung unter [Dienste](./TURNOS.md).

---

## Empfohlene Reihenfolge

1. Krankenhäuser und Ambulanzen  
2. Teams  
3. Dienst-Vorlagen und Wochen
