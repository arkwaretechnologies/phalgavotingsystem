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
  const gender = String(formData.get("gender") ?? "").trim() || null;
  const civil_status = String(formData.get("civil_status") ?? "").trim() || null;
  const date_of_birth = String(formData.get("date_of_birth") ?? "").trim() || null;
  const post_office_address = String(formData.get("post_office_address") ?? "").trim() || null;
  const present_position = String(formData.get("present_position") ?? "").trim() || null;
  const highest_educational_attainment =
    String(formData.get("highest_educational_attainment") ?? "").trim() || null;
  const provincial_league = String(formData.get("provincial_league") ?? "").trim() || null;

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

  const { data: inserted, error } = await supabase
    .from("candidates")
    .insert({
    geo_group_id,
    full_name: fullName,
    photo_url,
    bio,
    is_active,
    confcode,
    gender,
    civil_status,
    date_of_birth: date_of_birth ? date_of_birth : null,
    post_office_address,
    present_position,
    highest_educational_attainment,
    provincial_league,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    // eslint-disable-next-line no-console
    console.error("createCandidate failed", error);
    const { message } = toPublicMessage(error, "Unable to create candidate. Please try again.");
    redirect(`/admin/candidates?error=${encodeURIComponent(message)}`);
  }

  const candidateId = inserted?.id ? String(inserted.id) : "";
  if (candidateId) {
    const phalgaRows = Array.from({ length: 3 }).flatMap((_, idx) => {
      const position = String(formData.get(`phalga_position_${idx + 1}`) ?? "").trim();
      const period = String(formData.get(`phalga_period_${idx + 1}`) ?? "").trim();
      if (!position && !period) return [];
      return [
        {
          id: candidateId,
          linenum: idx + 1,
          position: position || null,
          period_covered: period || null,
        },
      ];
    });
    const provRows = Array.from({ length: 3 }).flatMap((_, idx) => {
      const position = String(formData.get(`prov_position_${idx + 1}`) ?? "").trim();
      const period = String(formData.get(`prov_period_${idx + 1}`) ?? "").trim();
      if (!position && !period) return [];
      return [
        {
          id: candidateId,
          linenum: idx + 1,
          position: position || null,
          period_covered: period || null,
        },
      ];
    });

    if (phalgaRows.length) {
      const { error: pErr } = await supabase.from("candidates_prev_curr_phalga").insert(phalgaRows);
      if (pErr) console.error("insert candidates_prev_curr_phalga failed", pErr);
    }
    if (provRows.length) {
      const { error: prErr } = await supabase
        .from("candidates_prev_curr_provincial_league")
        .insert(provRows);
      if (prErr) console.error("insert candidates_prev_curr_provincial_league failed", prErr);
    }
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
  const gender = String(formData.get("gender") ?? "").trim() || null;
  const civil_status = String(formData.get("civil_status") ?? "").trim() || null;
  const date_of_birth = String(formData.get("date_of_birth") ?? "").trim() || null;
  const post_office_address = String(formData.get("post_office_address") ?? "").trim() || null;
  const present_position = String(formData.get("present_position") ?? "").trim() || null;
  const highest_educational_attainment =
    String(formData.get("highest_educational_attainment") ?? "").trim() || null;
  const provincial_league = String(formData.get("provincial_league") ?? "").trim() || null;

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
    gender,
    civil_status,
    date_of_birth: date_of_birth ? date_of_birth : null,
    post_office_address,
    present_position,
    highest_educational_attainment,
    provincial_league,
  };
  if (photo_url !== undefined) update.photo_url = photo_url;

  const { error } = await supabase.from("candidates").update(update).eq("id", id);
  if (error) {
    // eslint-disable-next-line no-console
    console.error("updateCandidate failed", error);
    const { message } = toPublicMessage(error, "Unable to update candidate. Please try again.");
    redirect(`/admin/candidates?error=${encodeURIComponent(message)}`);
  }

  // Best-effort: rewrite the "previous/current positions" lists *only* when the form includes them.
  // This prevents accidental deletion when editing from a minimal form.
  const hasPrevCurrFields =
    formData.has("phalga_position_1") ||
    formData.has("phalga_period_1") ||
    formData.has("prov_position_1") ||
    formData.has("prov_period_1");
  if (hasPrevCurrFields) {
    // Tables use composite PK (id, linenum) where `id` references candidates(id).
    try {
      await supabase.from("candidates_prev_curr_phalga").delete().eq("id", id);
      await supabase.from("candidates_prev_curr_provincial_league").delete().eq("id", id);

      const phalgaRows = Array.from({ length: 3 }).flatMap((_, idx) => {
        const position = String(formData.get(`phalga_position_${idx + 1}`) ?? "").trim();
        const period = String(formData.get(`phalga_period_${idx + 1}`) ?? "").trim();
        if (!position && !period) return [];
        return [
          {
            id,
            linenum: idx + 1,
            position: position || null,
            period_covered: period || null,
          },
        ];
      });
      const provRows = Array.from({ length: 3 }).flatMap((_, idx) => {
        const position = String(formData.get(`prov_position_${idx + 1}`) ?? "").trim();
        const period = String(formData.get(`prov_period_${idx + 1}`) ?? "").trim();
        if (!position && !period) return [];
        return [
          {
            id,
            linenum: idx + 1,
            position: position || null,
            period_covered: period || null,
          },
        ];
      });

      if (phalgaRows.length) await supabase.from("candidates_prev_curr_phalga").insert(phalgaRows);
      if (provRows.length) {
        await supabase.from("candidates_prev_curr_provincial_league").insert(provRows);
      }
    } catch (e) {
      console.error("update candidate prev/curr positions failed", e);
    }
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

