import { format } from "date-fns";
import { fr } from "date-fns/locale";

/**
 * Always call this from a server component. Formatting a date in a client
 * component renders it in the browser's timezone and in the server's during SSR,
 * which React reports as a hydration mismatch.
 */
export function when(iso: string | null | undefined): string {
  return iso ? format(new Date(iso), "d MMM yyyy 'à' HH:mm", { locale: fr }) : "—";
}

export function day(iso: string | null | undefined): string {
  return iso ? format(new Date(iso), "d MMM yyyy", { locale: fr }) : "—";
}
