"use client";

import { Toaster } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      position="top-center"
      richColors
      closeButton
      duration={3500}
      toastOptions={{
        className: "text-sm",
      }}
    />
  );
}

