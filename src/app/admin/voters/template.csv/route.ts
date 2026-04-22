import { NextResponse } from "next/server";

const TEMPLATE = [
  [
    "full_name",
    "position",
    "lgu",
    "province",
    "province_league",
    "psgc_code",
    "email",
    "phone",
  ].join(","),
  [
    "Juan Dela Cruz",
    "Mayor",
    "Sample LGU",
    "Sample Province",
    "Sample League",
    "012345678",
    "juan@example.com",
    "+639171234567",
  ].join(","),
].join("\n");

export function GET() {
  return new NextResponse(TEMPLATE, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="voters_template.csv"',
      "Cache-Control": "no-store",
    },
  });
}

