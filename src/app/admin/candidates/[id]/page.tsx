import { notFound } from "next/navigation";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { toPublicMessage } from "@/lib/errors/public-message";
import { FullscreenButton } from "./fullscreen-button";

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
  geo_group?: GeoGroupLite | null;
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
  const bioParagraphs = typed.bio
    ? String(typed.bio)
        .split(/\n+/)
        .map((p) => p.trim())
        .filter(Boolean)
    : [];

  return (
    <main className="relative isolate min-h-dvh overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-neutral-50 via-white to-white"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[1] overflow-hidden"
      >
        {/* Blur + filter compositing is unreliable with bg-image alone in some browsers; use a real img. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt=""
          width={1600}
          height={1600}
          className="absolute left-1/2 top-1/2 h-[280vmin] w-[280vmin] max-w-none -translate-x-1/2 -translate-y-1/2 object-cover opacity-[0.22] blur-3xl will-change-transform"
        />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 top-10 z-[2] h-[28rem] w-[28rem] rounded-full bg-neutral-200/50 blur-3xl candidate-profile-blob"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 bottom-0 z-[2] h-[34rem] w-[34rem] rounded-full bg-neutral-200/40 blur-3xl candidate-profile-blob candidate-profile-blob-delay"
      />

      <div className="absolute right-5 top-5 z-10 sm:right-8 sm:top-8">
        <FullscreenButton />
      </div>

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-6xl flex-col items-center justify-center px-6 py-20 sm:py-24">
        <div className="grid w-full items-center gap-12 lg:grid-cols-[minmax(0,_22rem)_minmax(0,_1fr)] lg:gap-16">
          <div className="flex justify-center lg:justify-end candidate-profile-photo-wrap">
            {typed.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={typed.photo_url}
                alt={`${typed.full_name} portrait`}
                className="h-72 w-72 rounded-full object-cover shadow-[0_30px_80px_-30px_rgba(0,0,0,0.45)] ring-1 ring-neutral-200 sm:h-80 sm:w-80 lg:h-[22rem] lg:w-[22rem] candidate-profile-photo"
              />
            ) : (
              <div className="grid h-72 w-72 place-items-center rounded-full bg-neutral-100 text-sm text-neutral-500 ring-1 ring-neutral-200 sm:h-80 sm:w-80 lg:h-[22rem] lg:w-[22rem]">
                No photo
              </div>
            )}
          </div>

          <div className="text-center lg:text-left">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500 candidate-profile-stagger">
              Candidate
            </p>
            <h1 className="mt-2 text-4xl font-semibold leading-tight tracking-tight text-neutral-900 sm:text-5xl lg:text-6xl candidate-profile-stagger candidate-profile-stagger-1">
              {typed.full_name}
            </h1>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-neutral-600 lg:justify-start candidate-profile-stagger candidate-profile-stagger-2">
              {geoGroup ? (
                <span className="font-medium text-neutral-800">
                  {geoGroup.code} — {geoGroup.name}
                </span>
              ) : null}
              {geoGroup ? <span aria-hidden className="text-neutral-300">•</span> : null}
              <span className="font-mono text-neutral-700">{String(typed.confcode ?? "")}</span>
            </div>

            <div className="mt-8 max-w-2xl text-base leading-relaxed text-neutral-700 sm:text-[1.0625rem] candidate-profile-stagger candidate-profile-stagger-3">
              {bioParagraphs.length > 0 ? (
                bioParagraphs.map((p, idx) => (
                  <p key={idx} className={idx === 0 ? "mt-0" : "mt-4"}>
                    {p}
                  </p>
                ))
              ) : (
                <p className="text-neutral-500">No bio provided.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
