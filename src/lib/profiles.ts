import "server-only";
import { db } from "./db";

export type ProfileLite = {
  id: string;
  username: string;
  display_name: string | null;
  banned_at: string | null;
};

/**
 * publications.author_id and comments.author_id reference auth.users(id), not
 * profiles(id) — there is no foreign key between them, so PostgREST cannot
 * embed the author with `profiles!author_id(...)`. Resolving the ids in one
 * extra query keeps any listing at two round trips instead of N+1, without
 * adding a redundant constraint to the mobile app's schema.
 */
export async function fetchProfiles(
  ids: Iterable<string | null | undefined>,
): Promise<Record<string, ProfileLite>> {
  const unique = [...new Set([...ids].filter((id): id is string => !!id))];
  if (unique.length === 0) return {};

  const { data } = await db
    .from("profiles")
    .select("id, username, display_name, banned_at")
    .in("id", unique)
    .returns<ProfileLite[]>();

  return Object.fromEntries((data ?? []).map((profile) => [profile.id, profile]));
}
