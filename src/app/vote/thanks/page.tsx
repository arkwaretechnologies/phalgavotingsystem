import { VoteThanksClient } from "./vote-thanks-client";

export default function VoteThanksPage() {
  return (
    <div className="relative isolate min-h-dvh overflow-hidden bg-[#050203] font-sans text-white">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(99,102,241,0.18),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_10%_90%,rgba(34,211,238,0.14),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_90%_90%,rgba(16,185,129,0.12),transparent_55%)]" />
      </div>
      <VoteThanksClient />
    </div>
  );
}
