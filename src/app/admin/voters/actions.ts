"use server";

import Papa from "papaparse";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

type CsvRow = Record<string, string | undefined>;

function norm(v: unknown) {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

export async function importVotersCsv(formData: FormData) {
  const file = formData.get("csv");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Please upload a CSV file.");
  }

  const text = await file.text();
  const parsed = Papa.parse<CsvRow>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (parsed.errors?.length) {
    const msg = parsed.errors[0]?.message ?? "CSV parse error";
    throw new Error(msg);
  }

  const rows = (parsed.data ?? []).filter((r) => Object.keys(r).length > 0);
  if (rows.length === 0) throw new Error("CSV has no data rows.");

  const toInsert: Array<{
    full_name: string;
    position: string | null;
    lgu: string | null;
    province: string | null;
    province_league: string | null;
    psgc_code: string | null;
    email: string | null;
    phone: string | null;
  }> = [];

  let skipped = 0;
  for (const r of rows) {
    const full_name = norm(r.full_name);
    if (!full_name) {
      skipped += 1;
      continue;
    }

    toInsert.push({
      full_name,
      position: norm(r.position),
      lgu: norm(r.lgu),
      province: norm(r.province),
      province_league: norm(r.province_league),
      psgc_code: norm(r.psgc_code),
      email: norm(r.email),
      phone: norm(r.phone),
    });
  }

  if (toInsert.length === 0) throw new Error("No valid rows found (full_name is required).");

  const supabase = createSupabaseServiceRoleClient();

  // Insert in batches to avoid payload limits.
  const batchSize = 500;
  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += batchSize) {
    const batch = toInsert.slice(i, i + batchSize);
    const { error } = await supabase.from("voters").insert(batch);
    if (error) throw new Error(error.message);
    inserted += batch.length;
  }

  revalidatePath("/admin/voters");
  redirect(`/admin/voters?imported=${inserted}&skipped=${skipped}`);
}

