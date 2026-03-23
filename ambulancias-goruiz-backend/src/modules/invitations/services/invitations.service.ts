import crypto from "crypto";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import Invitation from "../models/invitation.model";
import User from "../../users/models/user.model";

const DEFAULT_EXPIRES_DAYS = 7;
const TOKEN_BYTES = 32;

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generateSecureToken(): string {
  return crypto.randomBytes(TOKEN_BYTES).toString("hex");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export interface CreateInvitationInput {
  email: string;
  role: "admin" | "worker";
  expiresInDays?: number;
  companyId: mongoose.Types.ObjectId;
  invitedBy: mongoose.Types.ObjectId;
}

export interface CreateInvitationResult {
  invitationId: string;
  token: string;
  expiresAt: Date;
}

export async function createInvitationService(
  input: CreateInvitationInput,
): Promise<CreateInvitationResult> {
  const { email, role, companyId, invitedBy } = input;
  const expiresInDays = input.expiresInDays ?? DEFAULT_EXPIRES_DAYS;

  const normalizedEmail = normalizeEmail(email);
  const token = generateSecureToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const invitation = await Invitation.create({
    companyId,
    email: normalizedEmail,
    role,
    tokenHash,
    expiresAt,
    invitedBy,
  });

  return {
    invitationId: String(invitation._id),
    token,
    expiresAt: invitation.expiresAt,
  };
}

export interface ValidateInvitationResult {
  valid: true;
  email: string;
  role: "admin" | "worker";
  companyName: string;
}

export async function validateInvitationService(
  token: string,
): Promise<ValidateInvitationResult | { valid: false; reason: string }> {
  if (!token || !token.trim()) {
    return { valid: false, reason: "Token inválido" };
  }

  const tokenHash = hashToken(token.trim());
  const invitation = await Invitation.findOne({ tokenHash })
    .populate("companyId", "name")
    .lean();

  if (!invitation) {
    return { valid: false, reason: "Invitación no encontrada" };
  }

  if (invitation.acceptedAt) {
    return { valid: false, reason: "Invitación ya utilizada" };
  }

  if (invitation.revokedAt) {
    return { valid: false, reason: "Invitación revocada" };
  }

  if (new Date() > new Date(invitation.expiresAt)) {
    return { valid: false, reason: "Invitación expirada" };
  }

  const company = invitation.companyId as unknown as { name?: string } | null;
  const companyName = company?.name ?? "";

  return {
    valid: true,
    email: invitation.email,
    role: invitation.role as "admin" | "worker",
    companyName,
  };
}

export interface AcceptInvitationInput {
  token: string;
  name: string;
  lastName: string;
  password: string;
}

export async function acceptInvitationService(input: AcceptInvitationInput) {
  const { token, name, lastName, password } = input;

  const validation = await validateInvitationService(token);
  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  const tokenHash = hashToken(token.trim());
  const invitation = await Invitation.findOne({ tokenHash });

  if (!invitation) {
    throw new Error("Invitación no encontrada");
  }

  const normalizedEmail = invitation.email;
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw new Error("Ya existe un usuario con ese email");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = await User.create({
    name: name.trim(),
    lastName: lastName.trim(),
    email: normalizedEmail,
    password: hashedPassword,
    role: invitation.role,
    companyId: invitation.companyId,
    invitationId: invitation._id,
  });

  invitation.acceptedAt = new Date();
  await invitation.save();

  return newUser;
}
