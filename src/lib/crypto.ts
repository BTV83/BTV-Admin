import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { hash as argonHash, verify as argonVerify } from "@node-rs/argon2";
import { env } from "./env";

const KEY = Buffer.from(env.ADMIN_TOTP_ENC_KEY, "base64");

/** Opaque session token. Returned to the browser once; only its hash is stored. */
export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function hashPassword(password: string): Promise<string> {
  return argonHash(password); // argon2id defaults
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argonVerify(hash, password);
  } catch {
    // Malformed hash in the database — treat as a failed login, never a crash.
    return false;
  }
}

// A precomputed hash of a random value. Verified against when no admin matches
// the submitted email, so that a wrong email and a wrong password take the same
// time and cannot be told apart.
let dummyHash: string | null = null;
export async function wasteTime(password: string): Promise<void> {
  if (!dummyHash) dummyHash = await argonHash(randomBytes(32).toString("hex"));
  await verifyPassword(dummyHash, password);
}

/** AES-256-GCM. Output: base64(iv) . base64(tag) . base64(ciphertext) */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    ct.toString("base64"),
  ].join(".");
}

export function decryptSecret(payload: string): string {
  const [iv, tag, ct] = payload.split(".");
  const decipher = createDecipheriv("aes-256-gcm", KEY, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ct, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
