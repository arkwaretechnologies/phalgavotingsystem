"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/admin/session";
import { toPublicMessage } from "@/lib/errors/public-message";

async function requireAdminPassword(password: string) {
  const admin = await getAdminSession();
  if (!admin) redirect("/admin/login");
  if (!password) throw new Error("Password is required");

  const supabase = createSupabaseServiceRoleClient();
  const { data: user, error } = await supabase
    .from("admin_users")
    .select("id, password_hash")
    .eq("id", admin.admin_user_id)
    .maybeSingle();

  if (error) throw error;
  if (!user?.password_hash) throw new Error("Unable to verify password.");

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) throw new Error("Invalid password.");

  return admin;
}

function norm(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

function buildVoterDraftParams(formData: FormData) {
  const params = new URLSearchParams();
  const keys = [
    "full_name",
    "position",
    "lgu",
    "province",
    "province_league",
    "psgc_code",
    "email",
    "phone",
  ] as const;
  for (const k of keys) {
    const v = String(formData.get(k) ?? "").trim();
    if (v) params.set(k, v);
  }
  return params;
}

export async function createVoter(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  try {
    await requireAdminPassword(password);

    const full_name = String(formData.get("full_name") ?? "").trim();
    if (!full_name) throw new Error("Full name is required");

    const supabase = createSupabaseServiceRoleClient();
    const { error } = await supabase.from("voters").insert({
      full_name,
      position: norm(formData.get("position")),
      lgu: norm(formData.get("lgu")),
      province: norm(formData.get("province")),
      province_league: norm(formData.get("province_league")),
      psgc_code: norm(formData.get("psgc_code")),
      email: norm(formData.get("email")),
      phone: norm(formData.get("phone")),
    });
    if (error) throw error;

    revalidatePath("/admin/voters");
    redirect("/admin/voters?toast=success&message=Voter%20created.");
  } catch (e) {
    unstable_rethrow(e);
    const { message } = toPublicMessage(e, "Unable to create voter. Please try again.");
    const isInvalidPassword = message.toLowerCase().includes("invalid password");
    if (isInvalidPassword) {
      const params = buildVoterDraftParams(formData);
      params.set("toast", "error");
      params.set("message", message);
      redirect(`/admin/voters/new?${params.toString()}`);
    }
    redirect(`/admin/voters/new?toast=error&message=${encodeURIComponent(message)}`);
  }
}

export async function updateVoter(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  try {
    await requireAdminPassword(password);
    if (!id) throw new Error("Missing voter id");

    const full_name = String(formData.get("full_name") ?? "").trim();
    if (!full_name) throw new Error("Full name is required");

    const supabase = createSupabaseServiceRoleClient();
    const { error } = await supabase
      .from("voters")
      .update({
        full_name,
        position: norm(formData.get("position")),
        lgu: norm(formData.get("lgu")),
        province: norm(formData.get("province")),
        province_league: norm(formData.get("province_league")),
        psgc_code: norm(formData.get("psgc_code")),
        email: norm(formData.get("email")),
        phone: norm(formData.get("phone")),
      })
      .eq("id", id);
    if (error) throw error;

    revalidatePath("/admin/voters");
    redirect(`/admin/voters?toast=success&message=${encodeURIComponent("Voter updated.")}`);
  } catch (e) {
    unstable_rethrow(e);
    const { message } = toPublicMessage(e, "Unable to update voter. Please try again.");
    const isInvalidPassword = message.toLowerCase().includes("invalid password");
    if (isInvalidPassword) {
      const params = buildVoterDraftParams(formData);
      params.set("toast", "error");
      params.set("message", message);
      redirect(`/admin/voters/${encodeURIComponent(id)}?${params.toString()}`);
    }
    redirect(`/admin/voters/${encodeURIComponent(id)}?toast=error&message=${encodeURIComponent(message)}`);
  }
}

export async function deleteVoter(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  try {
    await requireAdminPassword(password);
    if (!id) throw new Error("Missing voter id");

    const supabase = createSupabaseServiceRoleClient();
    const { error } = await supabase.from("voters").delete().eq("id", id);
    if (error) throw error;

    revalidatePath("/admin/voters");
    redirect(`/admin/voters?toast=success&message=${encodeURIComponent("Voter deleted.")}`);
  } catch (e) {
    unstable_rethrow(e);
    const { message } = toPublicMessage(e, "Unable to delete voter. Please try again.");
    redirect(`/admin/voters/${encodeURIComponent(id)}?toast=error&message=${encodeURIComponent(message)}`);
  }
}

