"use client";

import { useEffect } from "react";

/**
 * Root-level fallback when the root layout fails. This file is allowed to define `<html>` / `<body>`.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-neutral-900 antialiased">
        <main className="mx-auto max-w-lg p-6">
          <h1 className="text-2xl font-semibold text-neutral-900">Something went wrong</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Please try again. If the problem continues, ask an admin to check the server logs.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              className="ph-glossy-black rounded-md px-4 py-2 text-sm font-medium"
              onClick={() => reset()}
            >
              Try again
            </button>
            <a
              className="rounded-md border border-neutral-300 px-4 py-2 text-sm text-neutral-800 hover:bg-neutral-50"
              href="/"
            >
              Go to home
            </a>
          </div>

          {error?.digest ? (
            <p className="mt-6 text-xs text-neutral-500">
              Error reference: <span className="font-mono">{error.digest}</span>
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
