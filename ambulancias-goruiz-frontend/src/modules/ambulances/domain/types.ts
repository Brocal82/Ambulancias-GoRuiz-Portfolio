export interface Ambulance {
  _id: string;
  brand: string;
  modelName: string;
  licensePlate: string;
  ambulanceNumber: string;
}

export type AmbulanceFormValues = Omit<Ambulance, "_id">;

export type AmbulanceFormErrors = Partial<Record<keyof AmbulanceFormValues, string>>;