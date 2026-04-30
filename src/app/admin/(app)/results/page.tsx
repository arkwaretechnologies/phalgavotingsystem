import { redirect } from "next/navigation";

export default function AdminResultsLegacyRedirectPage() {
  redirect("/admin/canvass?tab=results");
}
