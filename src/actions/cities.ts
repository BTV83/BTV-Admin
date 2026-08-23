"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { fetchCommuneByInsee, INSEE_PATTERN } from "@/lib/geoApi";
import type { ActionState } from "@/lib/types";

const BUCKET = "city-images";

function revalidateCity(cityId: string) {
  revalidatePath("/cities");
  revalidatePath(`/cities/${cityId}`);
}

/** is_active gates whether a commune is open for posting. */
export async function setCityActive(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { admin } = await requireAdmin("manage_cities");

  const parsed = z
    .object({ cityId: z.string().uuid(), active: z.enum(["true", "false"]) })
    .safeParse({ cityId: formData.get("cityId"), active: formData.get("active") });

  if (!parsed.success) return { error: "Requête invalide." };

  const active = parsed.data.active === "true";

  const { data: before } = await db
    .from("cities")
    .select("id, name, is_active")
    .eq("id", parsed.data.cityId)
    .maybeSingle();

  if (!before) return { error: "Commune introuvable." };

  const { error } = await db
    .from("cities")
    .update({ is_active: active })
    .eq("id", parsed.data.cityId);

  if (error) return { error: error.message };

  await writeAudit({
    adminId: admin.id,
    action: active ? "city.activate" : "city.deactivate",
    targetType: "city",
    targetId: parsed.data.cityId,
    before,
    after: { is_active: active },
  });

  revalidateCity(parsed.data.cityId);
  return { ok: active ? `${before.name} activée.` : `${before.name} désactivée.` };
}

/**
 * Adds a commune, filling every field from the government API.
 *
 * Only the INSEE code crosses from the browser: the commune is re-fetched here
 * so name, population and coordinates always come from the authoritative
 * source, never from whatever the form posted.
 */
export async function importCity(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { admin } = await requireAdmin("manage_cities");

  const parsed = z
    .object({ inseeCode: z.string().regex(INSEE_PATTERN, "Code INSEE invalide.") })
    .safeParse({ inseeCode: String(formData.get("inseeCode") ?? "").toUpperCase() });

  if (!parsed.success) return { error: "Code INSEE invalide." };
  const { inseeCode } = parsed.data;

  const { data: existing } = await db
    .from("cities")
    .select("id, name")
    .eq("insee_code", inseeCode)
    .maybeSingle();

  if (existing) return { error: `${existing.name} est déjà dans la base.` };

  let commune;
  try {
    commune = await fetchCommuneByInsee(inseeCode);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "API géo indisponible." };
  }
  if (!commune) return { error: `Aucune commune pour le code ${inseeCode}.` };

  const row = {
    insee_code: commune.inseeCode,
    name: commune.name,
    postal_code: commune.postalCode,
    department: commune.department,
    latitude: commune.latitude,
    longitude: commune.longitude,
    population: commune.population,
    is_active: true,
  };

  const { data: created, error } = await db
    .from("cities")
    .insert(row)
    .select("id")
    .single();

  // 23505 = another admin added it between the check above and this insert.
  if (error) {
    return {
      error: error.code === "23505" ? "Commune déjà ajoutée." : error.message,
    };
  }

  await writeAudit({
    adminId: admin.id,
    action: "city.import",
    targetType: "city",
    targetId: created.id,
    after: row,
    reason: "Import API geo.api.gouv.fr",
  });

  revalidatePath("/cities");
  return { ok: `${commune.name} ajoutée.` };
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

/**
 * Uploads the commune's picture to the public city-images bucket. Clients have
 * no upload policy on that bucket, so this is the only way images get there.
 */
export async function uploadCityImage(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { admin } = await requireAdmin("manage_cities");

  const cityId = z.string().uuid().safeParse(formData.get("cityId"));
  if (!cityId.success) return { error: "Requête invalide." };

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return { error: "Aucun fichier." };
  if (!ALLOWED.includes(file.type)) return { error: "Formats acceptés : JPEG, PNG, WebP." };
  if (file.size > MAX_IMAGE_BYTES) return { error: "Image trop lourde (max 5 Mo)." };

  const { data: before } = await db
    .from("cities")
    .select("id, name, image_url")
    .eq("id", cityId.data)
    .maybeSingle();

  if (!before) return { error: "Commune introuvable." };

  const extension = file.type.split("/")[1]!.replace("jpeg", "jpg");
  // Suffixing with the timestamp avoids serving a stale cached image, since the
  // bucket is public and cached aggressively.
  const path = `${cityId.data}-${Date.now()}.${extension}`;

  const { error: uploadError } = await db.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });

  if (uploadError) return { error: uploadError.message };

  const {
    data: { publicUrl },
  } = db.storage.from(BUCKET).getPublicUrl(path);

  const { error } = await db
    .from("cities")
    .update({ image_url: publicUrl })
    .eq("id", cityId.data);

  if (error) return { error: error.message };

  await writeAudit({
    adminId: admin.id,
    action: "city.set_image",
    targetType: "city",
    targetId: cityId.data,
    before,
    after: { image_url: publicUrl },
  });

  revalidateCity(cityId.data);
  return { ok: "Image mise à jour." };
}
