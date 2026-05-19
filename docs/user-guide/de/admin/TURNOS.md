# Dienste und Planung (Administrator)

**Routen:** `/admin/dienst-templates`, `/admin/diensts`  
**Erforderliches Modul:** `scheduling`

---

## Begriffe

| Begriff | Bedeutung |
|---------|-----------|
| **Vorlage** | Wiederverwendbares Modell der Woche (welche Dienste es gibt und zu welchen Zeiten). |
| **Erstellte Woche** | Echte Dienste (Diensts), die für eine bestimmte Woche angelegt wurden. |
| **Zuweisung** | Person, Team oder Ambulanz, die mit einem Dienst und Tag verknüpft sind. |

---

## Üblicher Ablauf

### 1. Vorlagen anlegen oder bearbeiten

1. Öffnen Sie **Vorlagen** (`/admin/dienst-templates`).
2. Definieren Sie die Dienste (Dienst-Nummer, Zeiten, Tage).
3. Speichern Sie die Änderungen.

### 2. Woche erstellen

1. Unter **Planung** (`/admin/diensts`) wählen Sie die Woche (Startdatum).
2. Verwenden Sie **Woche erstellen** auf Basis der Vorlage.
3. Prüfen Sie den Wochenkalender.

### 3. Ressourcen zuweisen

In der Wochenansicht können Sie:

- **Mitarbeiter** Zeitslots zuweisen.
- **Teams** zuweisen (falls Teams genutzt werden).
- **Ambulanzen** zuweisen (falls das Modul aktiv ist).

Das System warnt bei **Überschneidungen** (dieselbe Person in zwei unvereinbaren Diensten).

### 4. Für Mitarbeiter veröffentlichen

Wenn die Woche fertig ist, sehen Mitarbeiter sie in:

- Mobile App → Register **Agenda**
- Worker-Web → `/dienst` (bei Nutzung des Browsers)

Mitarbeiter-Anleitung: [Agenda](../worker/AGENDA.md).

---

## Woche löschen oder neu erstellen

- Sie können **die erstellte Woche löschen** und aus der Vorlage neu erstellen.
- Vorsicht, wenn bereits **Arbeitstage oder Fahrten** zu diesen Diensten erfasst wurden; klären Sie mit Ihrer Führungskraft, bevor Sie laufende Wochen löschen.

---

## Excel-Planung

Wenn Ihr Unternehmen **Excel** statt (oder zusätzlich zu) manuellen Vorlagen nutzt, siehe [Excel-Planung](./PLANIFICACION-EXCEL.md).

---

## Tipps

- Halten Sie Vorlagen stabil und passen Sie nur Ausnahmen in der konkreten Woche an.
- Prüfen Sie Zeitkonflikte, bevor Sie die Woche abschließen.
- Mitarbeiter sehen nur **ihre** Zuweisungen, nicht die gesamte interne Planung, außer was das Panel erlaubt.
