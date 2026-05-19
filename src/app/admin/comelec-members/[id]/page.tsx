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

type ComelecMember = {
  id: string;
  name: string | null;
  position: string | null;
  comelec_position: string | null;
  lgu: string | null;
  province: string | null;
  confcode: string | null;
  photo_url: string | null;
  created_at: string;
};

export default async function AdminComelecMemberProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!id) notFound();

  const supabase = createSupabaseServiceRoleClient();
  const { data: member, error } = await supabase
    .from("comelec_members")
    .select("id, name, position, comelec_position, lgu, province, confcode, photo_url, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("admin comelec member profile load failed", error);
    const { message } = toPublicMessage(error, "Unable to load COMELEC member profile.");
    throw new Error(message);
  }

  if (!member) notFound();

  const typed = member as unknown as ComelecMember;
  const displayName = typed.name?.trim() || "—";
  const comelecLabel = typed.comelec_position?.trim() || "COMELEC MEMBER";
  const hasCustomComelecLabel = Boolean(typed.comelec_position?.trim());

  return (
    <main className="relative isolate min-h-dvh overflow-hidden bg-[#0a0820] text-white">
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/candidates-bg.png" alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0820]/40 via-[#0a0820]/55 to-[#0a0820]/85" />
      </div>

      <div className="absolute right-5 top-5 z-30 sm:right-8 sm:top-8">
        <FullscreenButton />
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -right-24 z-[1] hidden lg:block"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" className="h-[34rem] w-[34rem] opacity-[0.06]" />
      </div>

      <div className="absolute left-5 top-5 z-30 flex items-center gap-2.5 sm:left-8 sm:top-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="PhALGA logo" className="h-10 w-10 object-contain sm:h-12 sm:w-12" />
        <span className="text-xs font-bold uppercase tracking-[0.22em] text-white/80 sm:text-sm">
          PhALGA
        </span>
      </div>

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-7xl flex-col justify-center px-5 py-20 sm:px-8 sm:py-24 lg:px-10">
        <section className="grid flex-1 items-center gap-8 lg:grid-cols-[minmax(0,_34rem)_minmax(0,_1fr)] lg:gap-14">
          <div className="flex flex-col items-center gap-4 lg:items-start candidate-profile-photo-wrap">
            <div className="relative">
              <div
                aria-hidden
                className="absolute -inset-4 rounded-[32px] bg-gradient-to-br from-[#facc15]/40 via-white/10 to-[#ef4444]/40 blur-2xl"
              />
              {typed.photo_url ? (
                <>
                  <div className="relative h-[22rem] w-[22rem] overflow-hidden rounded-[28px] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)] ring-2 ring-white/15 sm:h-[28rem] sm:w-[28rem] lg:h-[34rem] lg:w-[34rem] candidate-profile-photo">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={typed.photo_url}
                      alt={`${displayName} portrait`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <p className="px-8 py-2 w-[22rem] text-center text-2xl font-bold uppercase tracking-[0.18em] text-[#facc15] sm:w-[28rem] sm:text-3xl lg:w-[34rem] lg:text-4xl whitespace-pre-line">
                    {comelecLabel}
                  </p>
                </>
              ) : (
                <div className="relative grid h-[22rem] w-[22rem] place-items-center rounded-[28px] bg-white/[0.06] px-6 text-center shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)] ring-2 ring-white/15 sm:h-[28rem] sm:w-[28rem] lg:h-[34rem] lg:w-[34rem] candidate-profile-photo">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#facc15] sm:text-xs">
                      Republic of the Philippines
                    </p>
                    <p
                      className={`${displayFont.className} mt-4 text-2xl font-black uppercase leading-tight tracking-wide text-white sm:text-3xl lg:text-4xl whitespace-pre-line`}
                    >
                      {hasCustomComelecLabel ? (
                        comelecLabel
                      ) : (
                        <>
                          COMELEC
                          <br />
                          Member
                        </>
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6 candidate-profile-stagger candidate-profile-stagger-1">
            <div className="candidate-profile-stagger">
              <h1
                className={`${displayFont.className} break-words text-4xl font-black leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-[3.25rem]`}
              >
                {displayName}
              </h1>
              <div aria-hidden className="mt-3 h-1 w-16 rounded-full bg-[#facc15]" />
            </div>

            <div className="grid gap-3 text-sm sm:grid-cols-3">
              {typed.position ? (
                <div className="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10 backdrop-blur-sm candidate-profile-stat">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#facc15]">
                    Position
                  </div>
                  <div className="mt-1 text-[15px] font-semibold text-white">{typed.position}</div>
                </div>
              ) : null}
              {typed.lgu ? (
                <div className="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10 backdrop-blur-sm candidate-profile-stat">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#facc15]">
                    LGU
                  </div>
                  <div className="mt-1 whitespace-pre-line text-[15px] font-medium text-white/95">
                    {typed.lgu}
                  </div>
                </div>
              ) : null}
              {typed.province ? (
                <div className="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10 backdrop-blur-sm candidate-profile-stat">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#facc15]">
                    Province
                  </div>
                  <div className="mt-1 text-[15px] font-semibold text-white">{typed.province}</div>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
