"use client";

import { useCallback, useEffect, useState } from "react";

export function FullscreenButton() {
  const [isFs, setIsFs] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    if (typeof document === "undefined") return;
    setSupported(Boolean(document.documentElement.requestFullscreen));
    const onChange = () => setIsFs(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggle = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error("fullscreen toggle failed", err);
    }
  }, []);

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      title={isFs ? "Exit fullscreen (Esc)" : "Enter fullscreen"}
      aria-label={isFs ? "Exit fullscreen" : "Enter fullscreen"}
      className="candidate-profile-fs-btn group inline-flex items-center gap-1.5 rounded-full border border-neutral-200/80 bg-white/80 px-3 py-1.5 text-xs font-medium text-neutral-800 shadow-sm backdrop-blur transition hover:bg-white"
    >
      <span aria-hidden className="grid h-3.5 w-3.5 place-items-center">
        {isFs ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5 transition-transform group-hover:scale-110"
          >
            <path d="M9 3H4v5" />
            <path d="M20 8V3h-5" />
            <path d="M4 16v5h5" />
            <path d="M15 21h5v-5" />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5 transition-transform group-hover:scale-110"
          >
            <path d="M8 3H3v5" />
            <path d="M21 8V3h-5" />
            <path d="M3 16v5h5" />
            <path d="M16 21h5v-5" />
          </svg>
        )}
      </span>
      {isFs ? "Exit fullscreen" : "Fullscreen"}
    </button>
  );
}
