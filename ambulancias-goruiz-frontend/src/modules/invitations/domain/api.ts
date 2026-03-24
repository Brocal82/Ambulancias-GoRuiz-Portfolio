import axios from "../../../api/axios";
import type {
  AcceptInvitationInput,
  CreateInvitationPayload,
  CreateInvitationResponse,
  ValidateInvitationResponse,
} from "./types";

export const validateInvitation = async (
  token: string,
): Promise<ValidateInvitationResponse> => {
  const res = await axios.get<ValidateInvitationResponse>(
    "/invitations/validate",
    {
      params: { token },
    },
  );
  return res.data;
};

export const acceptInvitation = async (data: AcceptInvitationInput) => {
  const res = await axios.post("/invitations/accept", data);
  return res.data;
};

export const createInvitation = async (
  data: CreateInvitationPayload,
): Promise<CreateInvitationResponse> => {
  const res = await axios.post<CreateInvitationResponse>("/invitations", data);
  return res.data;
};
