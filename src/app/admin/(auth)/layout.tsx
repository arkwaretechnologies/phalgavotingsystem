export default function AdminAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh w-full flex-1 bg-neutral-100 text-neutral-900">
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(5,2,3,0.05),transparent)]"
        aria-hidden
      />
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10 sm:px-6">
        <div className="admin-hero-fade rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-lg shadow-black/5 sm:p-8">
          {children}
        </div>
        <p className="admin-hero-fade admin-hero-fade-delay-1 mt-6 text-center text-xs text-neutral-500">
          Secure access to election operations
        </p>
      </main>
    </div>
  );
}
