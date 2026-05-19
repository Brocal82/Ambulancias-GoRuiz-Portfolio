# Catalogs: hospitals, ambulances, and teams (admin)

This master data feeds shifts, workdays, and mechanics.

---

## Hospitals

**Route:** `/admin/hospitals`  
**Module:** `hospitals`

- Add, edit, and remove destination hospitals.
- Workers select them when recording **trips** on the workday.

---

## Ambulances

**Route:** `/admin/ambulances`  
**Module:** `ambulances`

- License plate, ambulance number, identifying data.
- Assigned in **shifts** and **trips**.

---

## Teams

**Route:** `/admin/teams`  
**Module:** `teams`

- Define pairs or groups (driver + medic).
- Rotation modes (rotating, fixed, manual) per company configuration.
- Optional: fixed ambulance for the team.

Bulk assignment in [Shifts](./TURNOS.md).

---

## Suggested order

1. Hospitals and ambulances  
2. Teams  
3. Shift templates and weeks
