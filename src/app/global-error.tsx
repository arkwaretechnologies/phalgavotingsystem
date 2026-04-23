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
      <body className="min-h-screen bg-white text-black antialiased">
        <main className="mx-auto max-w-lg p-6">
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="mt-2 text-sm text-neutral-700">
            Please try again. If the problem continues, ask an admin to check the server logs.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-md bg-black px-4 py-2 text-sm text-white"
              onClick={() => reset()}
            >
              Try again
            </button>
            <a className="rounded-md border px-4 py-2 text-sm hover:bg-neutral-50" href="/">
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
