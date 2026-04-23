"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { toPublicMessage } from "@/lib/errors/public-message";

export async function createTablet(formData: FormData) {
  const label = String(formData.get("label") ?? "").trim();
  if (!label) throw new Error("Label is required");

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.from("tablets").insert({
    label,
    status: "offline",
    current_session: null,
    last_active_at: null,
  });
  if (error) {
    // eslint-disable-next-line no-console
    console.error("createTablet failed", error);
    const { message } = toPublicMessage(error, "Unable to create tablet. Please try again.");
    redirect(`/admin/tablets?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/admin/tablets");
  redirect("/admin/tablets");
}

export async function updateTablet(formData: FormData) {
  const idRaw = String(formData.get("id") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();

  const id = Number(idRaw);
  if (!Number.isFinite(id) || id <= 0) throw new Error("Invalid tablet id");
  if (!label) throw new Error("Label is required");

  if (!["vacant", "in_use", "offline"].includes(status)) {
    throw new Error("Invalid status");
  }

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.from("tablets").update({ label, status }).eq("id", id);
  if (error) {
    // eslint-disable-next-line no-console
    console.error("updateTablet failed", error);
    const { message } = toPublicMessage(error, "Unable to update tablet. Please try again.");
    redirect(`/admin/tablets/${id}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/admin/tablets");
  revalidatePath(`/admin/tablets/${id}`);
  redirect(`/admin/tablets/${id}`);
}

export async function deleteTablet(formData: FormData) {
  const idRaw = String(formData.get("id") ?? "").trim();
  const id = Number(idRaw);
  if (!Number.isFinite(id) || id <= 0) throw new Error("Invalid tablet id");

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.from("tablets").delete().eq("id", id);
  if (error) {
    // eslint-disable-next-line no-console
    console.error("deleteTablet failed", error);
    const { message } = toPublicMessage(error, "Unable to delete tablet. Please try again.");
    redirect(`/admin/tablets/${id}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/admin/tablets");
  redirect("/admin/tablets");
}

