/**
 * Voting UI is designed for a light surface. Force readable contrast when the
 * device uses dark mode (OS preference or auto-styled form controls).
 */
export default function VoteLayout({ children }: { children: React.ReactNode }) {
  return <div className="vote-surface min-h-dvh bg-white text-neutral-900">{children}</div>;
}
