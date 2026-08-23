import "server-only";
import { z } from "zod";

// Fail at boot rather than at the first request with a confusing error.
// Note the deliberate absence of any NEXT_PUBLIC_ variable: nothing here may
// ever reach the browser bundle.
const schema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(40),
  // 32 random bytes, base64. Encrypts TOTP secrets at rest so that a database
  // read is not by itself a second-factor bypass.
  ADMIN_TOTP_ENC_KEY: z.string().refine(
    (v) => Buffer.from(v, "base64").length === 32,
    "must be 32 bytes of base64 (openssl rand -base64 32)",
  ),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(
    `Invalid environment:\n${parsed.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n")}`,
  );
}

export const env = parsed.data;
