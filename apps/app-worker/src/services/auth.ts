import { LoginRequestDTO, LoginResponseDTO } from "../types/auth";
import { apiRequest } from "./http";

export async function login(input: LoginRequestDTO): Promise<LoginResponseDTO> {
  return apiRequest<LoginResponseDTO>("/users/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
