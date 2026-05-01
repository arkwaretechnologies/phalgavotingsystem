export default function AdminAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="ph-flag-hero-wash relative flex min-h-dvh w-full flex-1 flex-col bg-neutral-100 text-neutral-900">
      <div aria-hidden className="ph-flag-strip-top" />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10 sm:px-6">
        <div className="admin-hero-fade rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-lg shadow-[var(--ph-flag-blue-deep)]/10 sm:p-8">
          {children}
        </div>
        <p className="admin-hero-fade admin-hero-fade-delay-1 mt-6 text-center text-xs text-neutral-500">
          Secure access to election operations
        </p>
      </main>
      <div aria-hidden className="ph-flag-strip-bottom" />
    </div>
  );
}
