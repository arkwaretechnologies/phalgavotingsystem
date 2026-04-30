"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { toPublicMessage } from "@/lib/errors/public-message";
import { manilaDateAndTimeToUtcIso } from "@/lib/datetime/manila";

export async function setActiveConfcode(formData: FormData) {
  const confcodeRaw = String(formData.get("active_confcode") ?? "").trim();
  const active_confcode = confcodeRaw && confcodeRaw !== "null" ? confcodeRaw : null;

  const supabase = createSupabaseServiceRoleClient();

  if (active_confcode) {
    const { data: conf, error: confErr } = await supabase
      .from("conference")
      .select("confcode")
      .eq("confcode", active_confcode)
      .maybeSingle();
    if (confErr) {
      // eslint-disable-next-line no-console
      console.error("setActiveConfcode validate failed", confErr);
      const { message } = toPublicMessage(confErr, "Unable to validate conference code.");
      redirect(`/admin/settings/conference?error=${encodeURIComponent(message)}`);
    }
    if (!conf) throw new Error("Conference code not found");
  }

  const { error } = await supabase
    .from("app_settings")
    .upsert({ id: 1, active_confcode, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) {
    // eslint-disable-next-line no-console
    console.error("setActiveConfcode upsert failed", error);
    const { message } = toPublicMessage(error, "Unable to save settings. Please try again.");
    redirect(`/admin/settings/conference?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/admin/settings");
  revalidatePath("/admin/settings/conference");
  revalidatePath("/vote");
}

export async function setVotingSchedule(formData: FormData) {
  const startDate = String(formData.get("vote_start_date_pht") ?? "");
  const startTime = String(formData.get("vote_start_time_pht") ?? "");
  const endDate = String(formData.get("vote_end_date_pht") ?? "");
  const endTime = String(formData.get("vote_end_time_pht") ?? "");

  const startParsed = manilaDateAndTimeToUtcIso(startDate, startTime);
  const endParsed = manilaDateAndTimeToUtcIso(endDate, endTime);

  if (startParsed === "partial") {
    redirect(
      `/admin/settings/voting-schedule?error=${encodeURIComponent("Voting start needs both date and time, or leave both empty.")}`,
    );
  }
  if (endParsed === "partial") {
    redirect(
      `/admin/settings/voting-schedule?error=${encodeURIComponent("Voting end needs both date and time, or leave both empty.")}`,
    );
  }
  if (startParsed === "invalid") {
    redirect(
      `/admin/settings/voting-schedule?error=${encodeURIComponent("Voting start is not a valid date and time.")}`,
    );
  }
  if (endParsed === "invalid") {
    redirect(
      `/admin/settings/voting-schedule?error=${encodeURIComponent("Voting end is not a valid date and time.")}`,
    );
  }

  const vote_start_date_time = startParsed;
  const vote_end_date_time = endParsed;

  if (
    typeof vote_start_date_time === "string" &&
    typeof vote_end_date_time === "string" &&
    new Date(vote_end_date_time).getTime() <= new Date(vote_start_date_time).getTime()
  ) {
    redirect(
      `/admin/settings/voting-schedule?error=${encodeURIComponent(
        "Voting end (PHT) must be later than voting start (PHT). The end date and time must be strictly after the start.",
      )}`,
    );
  }

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("app_settings")
    .update({
      vote_start_date_time: vote_start_date_time ?? null,
      vote_end_date_time: vote_end_date_time ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  if (error) {
    // eslint-disable-next-line no-console
    console.error("setVotingSchedule update failed", error);
    const { message } = toPublicMessage(error, "Unable to save voting schedule. Please try again.");
    redirect(`/admin/settings/voting-schedule?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/settings");
  revalidatePath("/admin/settings/voting-schedule");
  revalidatePath("/vote");
}

