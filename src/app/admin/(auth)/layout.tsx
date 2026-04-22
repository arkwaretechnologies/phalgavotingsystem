export default function AdminAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-md p-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">{children}</div>
    </main>
  );
}

