"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireAdminSession } from "@/lib/admin/session";
import { toPublicMessage } from "@/lib/errors/public-message";

const STORAGE_BUCKET = "comelec";

function norm(v: unknown) {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

function parseSortOrder(v: unknown): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) throw new Error("Sort order must be a number.");
  return Math.trunc(n);
}

async function uploadComelecPhoto(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  confcode: string,
  photoFile: FormDataEntryValue | null,
): Promise<string | null> {
  if (!(photoFile instanceof File) || photoFile.size === 0) return null;

  const bytes = new Uint8Array(await photoFile.arrayBuffer());
  const safeConf = confcode.replace(/[^a-zA-Z0-9_-]/g, "_");
  const ext = (photoFile.name.split(".").pop() || "jpg").toLowerCase();
  const objectPath = `members/${safeConf}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadErr } = await supabase.storage.from(STORAGE_BUCKET).upload(objectPath, bytes, {
    contentType: photoFile.type || "application/octet-stream",
    upsert: false,
  });

  if (uploadErr) {
    console.error("comelec member photo upload failed", uploadErr);
    const { message } = toPublicMessage(uploadErr, "Unable to upload photo. Please try again.");
    redirect(`/admin/comelec-members?error=${encodeURIComponent(message)}`);
  }

  const { data: publicUrlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(objectPath);
  return publicUrlData.publicUrl ?? null;
}

export async function createComelecMember(formData: FormData) {
  await requireAdminSession();
  const name = String(formData.get("name") ?? "").trim();
  const confcode = String(formData.get("confcode") ?? "").trim();
  const position = norm(formData.get("position"));
  const comelec_position = norm(formData.get("comelec_position"));
  const sort_order = parseSortOrder(formData.get("sort_order"));
  const lgu = norm(formData.get("lgu"));
  const province = norm(formData.get("province"));

  if (!name) throw new Error("Name is required");
  if (!confcode) throw new Error("Active confcode is not set. Set it in Admin → Settings.");

  const supabase = createSupabaseServiceRoleClient();
  const photo_url = await uploadComelecPhoto(supabase, confcode, formData.get("photo_file"));

  const { error } = await supabase.from("comelec_members").insert({
    name,
    confcode,
    position,
    comelec_position,
    sort_order,
    lgu,
    province,
    photo_url,
  });

  if (error) {
    console.error("createComelecMember failed", error);
    const { message } = toPublicMessage(error, "Unable to create COMELEC member. Please try again.");
    redirect(`/admin/comelec-members?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/admin/comelec-members");
  redirect("/admin/comelec-members");
}

export async function updateComelecMember(formData: FormData) {
  await requireAdminSession();
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const confcode = String(formData.get("confcode") ?? "").trim();
  const position = norm(formData.get("position"));
  const comelec_position = norm(formData.get("comelec_position"));
  const sort_order = parseSortOrder(formData.get("sort_order"));
  const lgu = norm(formData.get("lgu"));
  const province = norm(formData.get("province"));

  if (!id) throw new Error("Missing member id");
  if (!name) throw new Error("Name is required");
  if (!confcode) throw new Error("Active confcode is not set. Set it in Admin → Settings.");

  const supabase = createSupabaseServiceRoleClient();

  const update: Record<string, unknown> = {
    name,
    confcode,
    position,
    comelec_position,
    sort_order,
    lgu,
    province,
  };
  const photo_url = await uploadComelecPhoto(supabase, confcode, formData.get("photo_file"));
  if (photo_url !== null) update.photo_url = photo_url;

  const { error } = await supabase.from("comelec_members").update(update).eq("id", id);

  if (error) {
    console.error("updateComelecMember failed", error);
    const { message } = toPublicMessage(error, "Unable to update COMELEC member. Please try again.");
    redirect(`/admin/comelec-members?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/admin/comelec-members");
  revalidatePath(`/admin/comelec-members/${id}`);
  redirect("/admin/comelec-members");
}

export async function deleteComelecMember(formData: FormData) {
  await requireAdminSession();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Missing member id");

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.from("comelec_members").delete().eq("id", id);
  if (error) {
    console.error("deleteComelecMember failed", error);
    const { message } = toPublicMessage(error, "Unable to delete COMELEC member. Please try again.");
    redirect(`/admin/comelec-members?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/admin/comelec-members");
  redirect("/admin/comelec-members");
}
