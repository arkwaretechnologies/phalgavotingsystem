import { UrlToasts } from "@/app/_components/UrlToasts";
import { utcIsoToManilaDateAndTime } from "@/lib/datetime/manila";
import { toPublicMessage } from "@/lib/errors/public-message";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { VotingScheduleForm } from "./voting-schedule-form";

export default async function AdminSettingsVotingSchedulePage() {
  const supabase = createSupabaseServiceRoleClient();
  const { data: settings, error } = await supabase
    .from("app_settings")
    .select("vote_start_date_time, vote_end_date_time, updated_at")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    console.error("voting schedule settings load failed", error);
    const { message } = toPublicMessage(error, "Unable to load settings right now.");
    throw new Error(message);
  }

  const startPht = utcIsoToManilaDateAndTime(
    (settings as { vote_start_date_time?: string | null } | null)?.vote_start_date_time ?? null,
  );
  const endPht = utcIsoToManilaDateAndTime(
    (settings as { vote_end_date_time?: string | null } | null)?.vote_end_date_time ?? null,
  );

  return (
    <div className="space-y-6">
      <UrlToasts clearParams={["error"]} />
      <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold">Voting schedule</h2>
        <p className="mt-2 text-sm text-neutral-600">
          Set when online voting is allowed. All times are{" "}
          <span className="font-medium">Philippine Time (PHT, UTC+8)</span>. Leave a field empty to
          leave that boundary open (no start or no end limit).
        </p>
        <VotingScheduleForm
          defaults={{
            startDate: startPht.date,
            startTime: startPht.time,
            endDate: endPht.date,
            endTime: endPht.time,
          }}
        />
      </div>
    </div>
  );
}
