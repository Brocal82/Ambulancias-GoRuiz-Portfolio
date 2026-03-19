import { RequestHandler } from "express";
import Dienst from "../../../../models/Dienst";

export const updateDienstPartial: RequestHandler = async (req, res) => {
  const { id } = req.params;
  const { assignments } = req.body;

  if (!assignments || !Array.isArray(assignments)) {
    res
      .status(400)
      .json({ message: "No se proporcionaron assignments válidos." });
    return;
  }

  try {
    const dienst = await Dienst.findById(id);
    if (!dienst) {
      res.status(404).json({ message: "Dienst no encontrado." });
      return;
    }

    for (const incoming of assignments) {
      // Copia mutable
      const updatedCopy: any = { ...incoming };

      // Normalización campos vacíos a undefined
      if (updatedCopy?._id === "") delete updatedCopy._id;
      if (updatedCopy?.driver === "") updatedCopy.driver = undefined;
      if (updatedCopy?.medic === "") updatedCopy.medic = undefined;
      // 🚦 Importante: NO tocar ambulanceId aquí; se gestiona más abajo según venga o no venga

// ✅ Validación de obligatorios (ambulancia NO es obligatoria)
// Reglas: date, startTime, endTime SIEMPRE.
// driver/medic pueden quedar vacíos (permitir "Sin asignar").
const missingRequired =
  !updatedCopy?.date || !updatedCopy?.startTime || !updatedCopy?.endTime;

if (missingRequired) {
  console.warn("Assignment incompleto ignorado (faltan obligatorios):", {
    date: updatedCopy?.date,
    startTime: updatedCopy?.startTime,
    endTime: updatedCopy?.endTime,
  });
  continue;
}


      // Buscar por fecha (tu lógica actual usa la fecha como clave)
      const idx = dienst.assignments.findIndex(
        (a: any) => a.date === updatedCopy.date,
      );

      // ¿El payload trae explícitamente el campo ambulanceId?
      const hasAmbulanceField = Object.prototype.hasOwnProperty.call(
        incoming,
        "ambulanceId",
      );

      if (idx !== -1) {
        // 🔁 Merge seguro sobre un assignment existente
        const prev = dienst.assignments[idx];

        // Detectar qué campos de rol llegan explícitamente en el payload
        const hasDriverField = Object.prototype.hasOwnProperty.call(
          incoming,
          "driver",
        );
        const hasMedicField = Object.prototype.hasOwnProperty.call(
          incoming,
          "medic",
        );

        // Actualiza SIEMPRE fecha y horas
        prev.date = updatedCopy.date;
        prev.startTime = updatedCopy.startTime;
        prev.endTime = updatedCopy.endTime;

        // Roles: solo tocamos el que llegue en el payload
        if (hasDriverField) {
  const incomingDriver = (incoming as any).driver;

  if (incomingDriver === "" || incomingDriver === null) {
    // ✅ Borrado robusto
    // @ts-ignore
    prev.driver = null;
    // @ts-ignore
    if ("driver" in prev) {
      // @ts-ignore
      delete prev.driver;
    }
  } else {
    prev.driver = updatedCopy.driver;
  }
}

if (hasMedicField) {
  const incomingMedic = (incoming as any).medic;

  if (incomingMedic === "" || incomingMedic === null) {
    // ✅ Borrado robusto
    // @ts-ignore
    prev.medic = null;
    // @ts-ignore
    if ("medic" in prev) {
      // @ts-ignore
      delete prev.medic;
    }
  } else {
    prev.medic = updatedCopy.medic;
  }
}


        // Ambulancia:
        // - si VIENE en el payload:
        //    * string válida -> asignar
        //    * "" o null     -> borrar explícitamente (unset real)
        // - si NO viene     -> conservar la previa
        if (hasAmbulanceField) {
          const amb = (incoming as any).ambulanceId;

          if (amb === "" || amb === null) {
            // ✅ Borrado robusto: pon null y elimina la clave para asegurar persistencia
            // @ts-ignore
            prev.ambulanceId = null;
            // @ts-ignore
            if ("ambulanceId" in prev) {
              // eliminar la clave del subdocumento
              // @ts-ignore
              delete prev.ambulanceId;
            }
          } else if (amb !== undefined) {
            // asignación/actualización
            // @ts-ignore
            prev.ambulanceId = amb;
          }
        }

        dienst.assignments[idx] = prev as any;
      } else {
        // ➕ Nuevo assignment: crear con obligatorios, permitiendo UNO solo de los roles
        const toInsert: any = {
          date: updatedCopy.date,
          startTime: updatedCopy.startTime,
          endTime: updatedCopy.endTime,
        };

        // Incluir SOLO los roles que TRAEN valor
        const hasDriverVal =
          updatedCopy?.driver !== undefined &&
          updatedCopy?.driver !== null &&
          updatedCopy?.driver !== "";
        const hasMedicVal =
          updatedCopy?.medic !== undefined &&
          updatedCopy?.medic !== null &&
          updatedCopy?.medic !== "";

        if (hasDriverVal) toInsert.driver = updatedCopy.driver;
        if (hasMedicVal) toInsert.medic = updatedCopy.medic;

        // Ambulancia solo si VIENE en el payload y no es ""/null
        if (hasAmbulanceField) {
          const amb = (incoming as any).ambulanceId;
          if (amb && amb !== "" && amb !== null) {
            toInsert.ambulanceId = amb;
          }
          // si llega ""/null => se omite, queda sin ambulancia
        }

        dienst.assignments.push(toInsert);
      }
    }

    await dienst.save();

    // Popular para respuesta coherente con el front
    const populated = await Dienst.findById(id)
      .populate(
        "assignments.driver",
        "name lastName pscheinExpiry ambulanceRole",
      )
      .populate(
        "assignments.medic",
        "name lastName pscheinExpiry ambulanceRole",
      )
      .populate(
        "assignments.ambulanceId",
        "ambulanceNumber brand modelName licensePlate",
      );

    res.json(populated ?? dienst);
  } catch (error) {
    console.error("Error al actualizar Dienst:", error);
    res.status(500).json({ message: "Error al actualizar Dienst" });
  }
};
