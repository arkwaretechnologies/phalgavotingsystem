"use client";

import { useState } from "react";
import { setVotingSchedule } from "@/app/admin/settings/actions";
import { manilaDateAndTimeToUtcIso } from "@/lib/datetime/manila";

type Defaults = {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
};

export function VotingScheduleForm({ defaults }: { defaults: Defaults }) {
  const [clientError, setClientError] = useState<string | null>(null);

  return (
    <form
      action={setVotingSchedule}
      onSubmit={(e) => {
        setClientError(null);
        const fd = new FormData(e.currentTarget);
        const startDate = String(fd.get("vote_start_date_pht") ?? "");
        const startTime = String(fd.get("vote_start_time_pht") ?? "");
        const endDate = String(fd.get("vote_end_date_pht") ?? "");
        const endTime = String(fd.get("vote_end_time_pht") ?? "");

        const startParsed = manilaDateAndTimeToUtcIso(startDate, startTime);
        const endParsed = manilaDateAndTimeToUtcIso(endDate, endTime);

        if (startParsed === "partial") {
          e.preventDefault();
          setClientError("Voting start needs both date and time, or leave both empty.");
          return;
        }
        if (endParsed === "partial") {
          e.preventDefault();
          setClientError("Voting end needs both date and time, or leave both empty.");
          return;
        }
        if (startParsed === "invalid") {
          e.preventDefault();
          setClientError("Voting start is not a valid date and time.");
          return;
        }
        if (endParsed === "invalid") {
          e.preventDefault();
          setClientError("Voting end is not a valid date and time.");
          return;
        }

        if (typeof startParsed === "string" && typeof endParsed === "string") {
          if (new Date(endParsed).getTime() <= new Date(startParsed).getTime()) {
            e.preventDefault();
            setClientError(
              "Voting end (PHT) must be later than voting start (PHT). Adjust the dates or times and try again.",
            );
            return;
          }
        }
      }}
      className="mt-6 max-w-md space-y-4"
    >
      <fieldset>
        <legend className="text-sm font-medium">Voting starts (PHT)</legend>
        <div className="mt-2 flex flex-wrap gap-3">
          <label className="block min-w-[10rem] flex-1">
            <span className="text-xs text-neutral-600">Date</span>
            <input
              type="date"
              name="vote_start_date_pht"
              defaultValue={defaults.startDate}
              className="mt-0.5 w-full rounded-md border px-3 py-2"
            />
          </label>
          <label className="block w-36">
            <span className="text-xs text-neutral-600">Time</span>
            <input
              type="time"
              name="vote_start_time_pht"
              defaultValue={defaults.startTime}
              step={60}
              className="mt-0.5 w-full rounded-md border px-3 py-2"
            />
          </label>
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-medium">Voting ends (PHT)</legend>
        <div className="mt-2 flex flex-wrap gap-3">
          <label className="block min-w-[10rem] flex-1">
            <span className="text-xs text-neutral-600">Date</span>
            <input
              type="date"
              name="vote_end_date_pht"
              defaultValue={defaults.endDate}
              className="mt-0.5 w-full rounded-md border px-3 py-2"
            />
          </label>
          <label className="block w-36">
            <span className="text-xs text-neutral-600">Time</span>
            <input
              type="time"
              name="vote_end_time_pht"
              defaultValue={defaults.endTime}
              step={60}
              className="mt-0.5 w-full rounded-md border px-3 py-2"
            />
          </label>
        </div>
      </fieldset>
      {clientError ? (
        <p className="text-sm text-red-700" role="alert">
          {clientError}
        </p>
      ) : null}
      <button type="submit" className="h-10 rounded-md bg-black px-4 text-sm text-white">
        Save
      </button>
    </form>
  );
}
