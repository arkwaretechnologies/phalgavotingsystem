import { getAdminResultsPayload } from "@/lib/admin/results-tallies";
import { AdminResultsReport } from "./admin-results-report";

export default async function AdminResultsPage() {
  const initial = await getAdminResultsPayload();
  return <AdminResultsReport initial={initial} />;
}
