"use client";

import { useFormStatus } from "react-dom";

type Props = React.ComponentProps<"button"> & {
  pendingLabel?: string;
};

export function SubmitButton({
  children,
  pendingLabel = "Submitting…",
  disabled,
  ...props
}: Props) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} {...props}>
      {pending ? pendingLabel : children}
    </button>
  );
}
