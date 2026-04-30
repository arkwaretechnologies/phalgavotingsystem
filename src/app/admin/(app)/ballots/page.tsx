import { redirect } from "next/navigation";

export default function AdminBallotsLegacyRedirectPage() {
  redirect("/admin/canvass?tab=ballots");
}
