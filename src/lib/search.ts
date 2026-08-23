/**
 * PostgREST's .or() / .like() take a raw filter *string*, not a bound parameter.
 * Characters like , ( ) . : are syntax there, so passing a search box straight
 * through lets a crafted URL rewrite the query — an admin clicking a malicious
 * /users?q=… link would run it with service_role privileges.
 *
 * Strip the syntactic characters and the LIKE wildcards, and cap the length.
 */
export function sanitizeSearch(input: string | undefined): string | undefined {
  if (!input) return undefined;

  const cleaned = input
    .replace(/[,()".:\\*%_]/g, " ")
    .trim()
    .slice(0, 80);

  return cleaned.length > 0 ? cleaned : undefined;
}
