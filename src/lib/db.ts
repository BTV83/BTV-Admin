import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

// The service_role key bypasses every RLS policy in the database. This module
// is the only place it is referenced, and the `server-only` import above turns
// any client-component import of it into a build error rather than a runtime
// leak.
//
// Never export this client to a component. Route every mutation through a
// server action that calls requireAdmin() first.
export const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
