import { VoteThanksClient } from "./vote-thanks-client";

export default function VoteThanksPage() {
  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-[var(--ph-flag-blue-deep)] font-sans text-white">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(0,56,168,0.55),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_10%_95%,rgba(206,17,38,0.32),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_90%_95%,rgba(252,209,22,0.18),transparent_55%)]" />
      </div>
      <div aria-hidden className="ph-flag-strip-top" />
      <div className="flex-1">
        <VoteThanksClient />
      </div>
      <div aria-hidden className="ph-flag-strip-bottom" />
    </div>
  );
}
