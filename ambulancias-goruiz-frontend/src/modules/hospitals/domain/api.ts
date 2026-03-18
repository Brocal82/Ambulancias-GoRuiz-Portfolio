import axios from "../../../api/axios";
import type { Hospital } from "./types";

const BASE_URL = "/hospitals";

export const getAllHospitals = async (token: string): Promise<Hospital[]> => {
  const res = await axios.get(BASE_URL);
  return res.data;
};

export const createHospital = async (
  hospital: Partial<Hospital>,
  token: string,
): Promise<Hospital> => {
  const res = await axios.post(BASE_URL, hospital);
  return res.data;
};

export const updateHospital = async (
  id: string,
  updatedHospital: Partial<Hospital>,
  token: string,
): Promise<Hospital> => {
  const res = await axios.patch(`${BASE_URL}/${id}`, updatedHospital);
  return res.data;
};

export const deleteHospital = async (
  id: string,
  token: string,
): Promise<void> => {
  await axios.delete(`${BASE_URL}/${id}`);
};
