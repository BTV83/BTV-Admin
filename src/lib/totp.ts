import "server-only";
import { generateSecret, generateURI, verify } from "otplib";

// otplib v13 exposes a functional API that differs substantially from v12's
// `authenticator` object. Wrapping it here keeps that detail in one file.

const ISSUER = "BTV Admin";

// Accept the adjacent 30-second step in each direction, so a slightly skewed
// phone clock does not lock an admin out.
const EPOCH_TOLERANCE_SECONDS = 30;

export function newTotpSecret(): string {
  return generateSecret();
}

export function totpUri(email: string, secret: string): string {
  return generateURI({ issuer: ISSUER, label: email, secret });
}

export async function checkTotp(token: string, secret: string): Promise<boolean> {
  const result = await verify({
    secret,
    token,
    epochTolerance: EPOCH_TOLERANCE_SECONDS,
  });
  return result.valid;
}
