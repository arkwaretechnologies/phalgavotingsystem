import { notFound } from "next/navigation";
import { Playfair_Display } from "next/font/google";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { toPublicMessage } from "@/lib/errors/public-message";
import { FullscreenButton } from "./fullscreen-button";

const displayFont = Playfair_Display({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  display: "swap",
});

type GeoGroupLite = {
  id: number;
  code: string;
  name: string;
};

type CandidateWithGeo = {
  id: string;
  full_name: string;
  bio: string | null;
  photo_url: string | null;
  is_active: boolean | null;
  confcode: string;
  created_at: string;
  present_position: string | null;
  lgu_address: string | null;
  highest_educational_attainment: string | null;
  geo_group?: GeoGroupLite | null;
};

type PrevCurrLine = {
  linenum: number;
  position: string | null;
  period_covered: string | null;
};

export default async function AdminCandidateProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!id) notFound();

  const supabase = createSupabaseServiceRoleClient();

  const { data: candidate, error } = await supabase
    .from("candidates")
    .select(
      `
      id,
      full_name,
      bio,
      photo_url,
      is_active,
      confcode,
      created_at,
      present_position,
      lgu_address,
      highest_educational_attainment,
      geo_group:geo_groups (
        id,
        code,
        name
      )
    `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("admin candidate profile load failed", error);
    const { message } = toPublicMessage(error, "Unable to load candidate profile.");
    throw new Error(message);
  }

  if (!candidate) notFound();

  const typed = candidate as unknown as CandidateWithGeo;
  const geoGroup = typed.geo_group ?? null;

  const [{ data: phalgaRows, error: phErr }, { data: provRows, error: provErr }] =
    await Promise.all([
      supabase
        .from("candidates_prev_curr_phalga")
        .select("linenum, position, period_covered")
        .eq("id", id)
        .order("linenum", { ascending: true }),
      supabase
        .from("candidates_prev_curr_provincial_league")
        .select("linenum, position, period_covered")
        .eq("id", id)
        .order("linenum", { ascending: true }),
    ]);

  if (phErr || provErr) {
    console.error("admin candidate prev/curr load failed", { phErr, provErr });
  }

  const phalgaLines: PrevCurrLine[] = ((phalgaRows ?? []) as PrevCurrLine[]).filter(
    (r) => (r.position && r.position.trim()) || (r.period_covered && r.period_covered.trim()),
  );
  const provLines: PrevCurrLine[] = ((provRows ?? []) as PrevCurrLine[]).filter(
    (r) => (r.position && r.position.trim()) || (r.period_covered && r.period_covered.trim()),
  );

  const bioParagraphs = typed.bio
    ? String(typed.bio)
        .split(/\n+/)
        .map((p) => p.trim())
        .filter(Boolean)
    : [];

  return (
    <main className="relative isolate min-h-dvh overflow-hidden bg-[#0a0820] text-white">
      {/* Background image */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/candidates-bg.png"
          alt=""
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0820]/40 via-[#0a0820]/55 to-[#0a0820]/85" />
      </div>

      {/* Fullscreen button */}
      <div className="absolute right-5 top-5 z-30 sm:right-8 sm:top-8">
        <FullscreenButton />
      </div>

      {/* Watermark logo */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -right-24 z-[1] hidden lg:block"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt=""
          className="h-[34rem] w-[34rem] opacity-[0.06]"
        />
      </div>

      {/* Top-left PhALGA brand */}
      <div className="absolute left-5 top-5 z-30 flex items-center gap-2.5 sm:left-8 sm:top-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="PhALGA logo"
          className="h-10 w-10 object-contain sm:h-12 sm:w-12"
        />
        <span className="text-xs font-bold uppercase tracking-[0.22em] text-white/80 sm:text-sm">
          PhALGA
        </span>
      </div>

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-7xl flex-col justify-center px-5 py-20 sm:px-8 sm:py-24 lg:px-10">
        {/* BODY */}
        <section className="grid flex-1 items-center gap-8 lg:grid-cols-[minmax(0,_34rem)_minmax(0,_1fr)] lg:gap-14">
          {/* PHOTO COLUMN */}
          <div className="flex justify-center lg:justify-start candidate-profile-photo-wrap">
            <div className="relative">
              <div
                aria-hidden
                className="absolute -inset-4 rounded-[32px] bg-gradient-to-br from-[#facc15]/40 via-white/10 to-[#ef4444]/40 blur-2xl"
              />
              {typed.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={typed.photo_url}
                  alt={`${typed.full_name} portrait`}
                  className="relative h-[22rem] w-[22rem] rounded-[28px] object-cover shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)] ring-2 ring-white/15 sm:h-[28rem] sm:w-[28rem] lg:h-[34rem] lg:w-[34rem] candidate-profile-photo"
                />
              ) : (
                <div className="relative grid h-[22rem] w-[22rem] place-items-center rounded-[28px] bg-white/10 text-sm text-white/70 ring-2 ring-white/15 sm:h-[28rem] sm:w-[28rem] lg:h-[34rem] lg:w-[34rem]">
                  No photo
                </div>
              )}
            </div>
          </div>

          {/* DETAILS COLUMN */}
          <div className="space-y-6 candidate-profile-stagger candidate-profile-stagger-1">
            {/* Name (top of details column) */}
            <div className="candidate-profile-stagger">
              <h1
                className={`${displayFont.className} break-words text-4xl font-black leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-[3.25rem]`}
              >
                {typed.full_name}
              </h1>
              <div
                aria-hidden
                className="mt-3 h-1 w-16 rounded-full bg-[#facc15]"
              />
            </div>

            {/* Quick info cards row */}
            <div className="grid gap-3 text-sm sm:grid-cols-3">
              {typed.present_position ? (
                <div className="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10 backdrop-blur-sm candidate-profile-stat">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#facc15]">
                    Present position
                  </div>
                  <div className="mt-1 text-[15px] font-semibold text-white">
                    {typed.present_position}
                  </div>
                </div>
              ) : null}
              {typed.lgu_address ? (
                <div className="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10 backdrop-blur-sm candidate-profile-stat">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#facc15]">
                    LGU address
                  </div>
                  <div className="mt-1 whitespace-pre-line text-[15px] font-medium text-white/95">
                    {typed.lgu_address}
                  </div>
                </div>
              ) : null}
              {geoGroup || typed.confcode ? (
                <div className="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10 backdrop-blur-sm candidate-profile-stat">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#facc15]">
                    Geo group
                  </div>
                  {geoGroup ? (
                    <div className="mt-1 text-[15px] font-semibold text-white">
                      {geoGroup.code} — {geoGroup.name}
                    </div>
                  ) : null}
                  {typed.confcode ? (
                    <div className="mt-0.5 font-mono text-xs text-white/70">
                      {String(typed.confcode)}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* EDUCATION */}
            <FactSection title="Education">
              {typed.highest_educational_attainment ? (
                <ul className="space-y-1.5">
                  <FactBullet>
                    <span className="font-semibold">Highest educational attainment:</span>{" "}
                    {typed.highest_educational_attainment}
                  </FactBullet>
                </ul>
              ) : (
                <EmptyNote>No educational attainment provided.</EmptyNote>
              )}
            </FactSection>

            {/* PHALGA POSITIONS */}
            <FactSection title="Previous / Current Positions in PhALGA">
              {phalgaLines.length > 0 ? (
                <ul className="space-y-1.5">
                  {phalgaLines.map((line) => (
                    <FactBullet key={`phalga-${line.linenum}`}>
                      <PositionLine
                        position={line.position}
                        period={line.period_covered}
                      />
                    </FactBullet>
                  ))}
                </ul>
              ) : (
                <EmptyNote>No PhALGA positions on record.</EmptyNote>
              )}
            </FactSection>

            {/* PROVINCIAL ASSOCIATION POSITIONS */}
            <FactSection title="Previous / Current Positions in Provincial Association">
              {provLines.length > 0 ? (
                <ul className="space-y-1.5">
                  {provLines.map((line) => (
                    <FactBullet key={`prov-${line.linenum}`}>
                      <PositionLine
                        position={line.position}
                        period={line.period_covered}
                      />
                    </FactBullet>
                  ))}
                </ul>
              ) : (
                <EmptyNote>No Provincial Association positions on record.</EmptyNote>
              )}
            </FactSection>

            {/* BIO (only if present) */}
            {bioParagraphs.length > 0 ? (
              <div className="rounded-2xl bg-white/[0.06] p-5 ring-1 ring-white/10 backdrop-blur-sm">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#facc15]">
                  Bio
                </div>
                <div className="mt-2 space-y-2 text-[15px] leading-relaxed text-white/90">
                  {bioParagraphs.map((p, idx) => (
                    <p key={idx}>{p}</p>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function FactSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="inline-flex items-center rounded-md bg-[#facc15] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#1a1a1a] shadow-sm sm:text-xs">
        {title}
      </h2>
      <div className="mt-3 text-[15px] leading-relaxed text-white/95 sm:text-base">{children}</div>
    </section>
  );
}

function FactBullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span aria-hidden className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#facc15]" />
      <span className="min-w-0">{children}</span>
    </li>
  );
}

function PositionLine({
  position,
  period,
}: {
  position: string | null;
  period: string | null;
}) {
  const pos = (position ?? "").trim();
  const per = (period ?? "").trim();
  if (pos && per) {
    return (
      <span>
        <span className="font-semibold">{pos}</span>{" "}
        <span className="text-white/75">({per})</span>
      </span>
    );
  }
  if (pos) return <span className="font-semibold">{pos}</span>;
  if (per) return <span className="text-white/75">{per}</span>;
  return null;
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="text-sm italic text-white/55">{children}</p>;
}
