"use client";

import { useState } from "react";

type Props = {
  name?: string;
  required?: boolean;
  autoComplete?: string;
  defaultValue?: string;
  /** Margin + positioning for the field row (e.g. `mt-1.5`). */
  wrapperClassName?: string;
  className: string;
};

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M10.7 10.7a3 3 0 1 0 4.2 4.2" />
      <path d="M6.34 6.34A10.06 10.06 0 0 0 2 12s3.5 7 10 7a9.84 9.84 0 0 0 4.88-1.39" />
      <path d="M9.88 5.09A9.77 9.77 0 0 1 12 5c6.5 0 10 7 10 7a18.14 18.14 0 0 1-2.84 4.16" />
      <path d="M14.12 14.12A3 3 0 0 1 9.88 9.88" />
      <path d="m2 2 20 20" />
    </svg>
  );
}

export function PasswordFieldWithReveal({
  name = "password",
  required,
  autoComplete,
  defaultValue,
  wrapperClassName = "",
  className,
}: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={`relative ${wrapperClassName}`.trim()}>
      <input
        name={name}
        type={visible ? "text" : "password"}
        required={required}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        className={`${className} pe-11`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute end-2 top-1/2 z-10 -translate-y-1/2 rounded-md p-1.5 text-neutral-500 outline-none transition hover:bg-neutral-100 hover:text-neutral-800 focus-visible:ring-2 focus-visible:ring-[var(--ph-brand-blue)]/30"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
      >
        {visible ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
      </button>
    </div>
  );
}
