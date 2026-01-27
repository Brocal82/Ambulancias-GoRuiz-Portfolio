export interface Hospital {
  _id: string;
  name: string;
  address: string;
  phone: string;
  specialties: string[];
  isOpen: boolean;
}

// Inputs (DTOs) para crear/editar desde UI
export interface CreateHospitalInput {
  name: string;
  address: string;
  phone: string;
  specialties: string[];
}

// Para update en UI: mismo shape que create + isOpen opcional
export interface UpdateHospitalInput extends CreateHospitalInput {
  isOpen?: boolean;
}

