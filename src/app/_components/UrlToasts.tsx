"use client";

import { useUrlToast } from "@/lib/toast/url-toast";

export function UrlToasts(props: {
  kindKey?: string;
  messageKey?: string;
  clearParams?: string[];
}) {
  useUrlToast({
    keys: { kind: props.kindKey, message: props.messageKey },
    clearParams: props.clearParams,
  });
  return null;
}

