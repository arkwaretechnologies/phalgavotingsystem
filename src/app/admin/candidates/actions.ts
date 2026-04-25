"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { toPublicMessage } from "@/lib/errors/public-message";

export async function createCandidate(formData: FormData) {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const confcode = String(formData.get("confcode") ?? "").trim();
  const photoFile = formData.get("photo_file");
  const bioRaw = String(formData.get("bio") ?? "").trim();
  const geoGroupIdRaw = String(formData.get("geo_group_id") ?? "").trim();

  if (!fullName) throw new Error("Full name is required");
  if (!confcode) throw new Error("Active confcode is not set. Set it in Admin → Settings.");

  const supabase = createSupabaseServiceRoleClient();

  let photo_url: string | null = null;
  if (photoFile instanceof File && photoFile.size > 0) {
    const bytes = new Uint8Array(await photoFile.arrayBuffer());
    const safeConf = confcode.replace(/[^a-zA-Z0-9_-]/g, "_");
    const ext = (photoFile.name.split(".").pop() || "jpg").toLowerCase();
    const objectPath = `candidates/${safeConf}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("candidates")
      .upload(objectPath, bytes, {
        contentType: photoFile.type || "application/octet-stream",
        upsert: false,
      });
    if (uploadErr) {
      // eslint-disable-next-line no-console
      console.error("candidate photo upload failed", uploadErr);
      const { message } = toPublicMessage(uploadErr, "Unable to upload photo. Please try again.");
      redirect(`/admin/candidates?error=${encodeURIComponent(message)}`);
    }

    const { data: publicUrlData } = supabase.storage.from("candidates").getPublicUrl(objectPath);
    photo_url = publicUrlData.publicUrl ?? null;
  }

  const bio = bioRaw ? bioRaw : null;
  const is_active = formData.get("is_active") === "on";
  const geo_group_id =
    geoGroupIdRaw && geoGroupIdRaw !== "null" && geoGroupIdRaw !== ""
      ? Number(geoGroupIdRaw)
      : null;

  if (geo_group_id == null || !Number.isFinite(geo_group_id) || geo_group_id <= 0) {
    redirect(`/admin/candidates?error=${encodeURIComponent("Geo group is required.")}`);
  }

  const { error } = await supabase.from("candidates").insert({
    geo_group_id,
    full_name: fullName,
    photo_url,
    bio,
    is_active,
    confcode,
  });

  if (error) {
    // eslint-disable-next-line no-console
    console.error("createCandidate failed", error);
    const { message } = toPublicMessage(error, "Unable to create candidate. Please try again.");
    redirect(`/admin/candidates?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/admin/candidates");
  redirect("/admin/candidates");
}

export async function updateCandidate(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const confcode = String(formData.get("confcode") ?? "").trim();
  const photoFile = formData.get("photo_file");
  const bioRaw = String(formData.get("bio") ?? "").trim();
  const isActiveRaw = String(formData.get("is_active") ?? "off");
  const geoGroupIdRaw = String(formData.get("geo_group_id") ?? "").trim();

  if (!id) throw new Error("Missing candidate id");
  if (!fullName) throw new Error("Full name is required");
  if (!confcode) throw new Error("Active confcode is not set. Set it in Admin → Settings.");

  const supabase = createSupabaseServiceRoleClient();

  let photo_url: string | null | undefined = undefined;
  if (photoFile instanceof File && photoFile.size > 0) {
    const bytes = new Uint8Array(await photoFile.arrayBuffer());
    const safeConf = confcode.replace(/[^a-zA-Z0-9_-]/g, "_");
    const ext = (photoFile.name.split(".").pop() || "jpg").toLowerCase();
    const objectPath = `candidates/${safeConf}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("candidates")
      .upload(objectPath, bytes, {
        contentType: photoFile.type || "application/octet-stream",
        upsert: false,
      });
    if (uploadErr) {
      // eslint-disable-next-line no-console
      console.error("candidate photo upload failed", uploadErr);
      const { message } = toPublicMessage(uploadErr, "Unable to upload photo. Please try again.");
      redirect(`/admin/candidates?error=${encodeURIComponent(message)}`);
    }

    const { data: publicUrlData } = supabase.storage.from("candidates").getPublicUrl(objectPath);
    photo_url = publicUrlData.publicUrl ?? null;
  }

  const bio = bioRaw ? bioRaw : null;
  const is_active = isActiveRaw === "on" || isActiveRaw === "true";
  const geo_group_id =
    geoGroupIdRaw && geoGroupIdRaw !== "null" && geoGroupIdRaw !== ""
      ? Number(geoGroupIdRaw)
      : null;
  if (geo_group_id == null || !Number.isFinite(geo_group_id) || geo_group_id <= 0) {
    redirect(`/admin/candidates?error=${encodeURIComponent("Geo group is required.")}`);
  }

  const update: Record<string, unknown> = {
    full_name: fullName,
    bio,
    is_active,
    geo_group_id,
  };
  if (photo_url !== undefined) update.photo_url = photo_url;

  const { error } = await supabase.from("candidates").update(update).eq("id", id);
  if (error) {
    // eslint-disable-next-line no-console
    console.error("updateCandidate failed", error);
    const { message } = toPublicMessage(error, "Unable to update candidate. Please try again.");
    redirect(`/admin/candidates?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/admin/candidates");
  redirect("/admin/candidates");
}

export async function deleteCandidate(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Missing candidate id");

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.from("candidates").delete().eq("id", id);
  if (error) {
    // eslint-disable-next-line no-console
    console.error("deleteCandidate failed", error);
    const { message } = toPublicMessage(error, "Unable to delete candidate. Please try again.");
    redirect(`/admin/candidates?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/admin/candidates");
  redirect("/admin/candidates");
}

