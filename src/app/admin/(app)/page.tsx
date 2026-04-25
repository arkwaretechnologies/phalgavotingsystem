import { getDashboardSnapshot } from "@/lib/admin/dashboard-snapshot";
import { DashboardCharts } from "./dashboard-charts";

export default async function AdminDashboardPage() {
  const dashboardSnapshot = await getDashboardSnapshot();

  return (
    <div className="space-y-6">
      <DashboardCharts initial={dashboardSnapshot} />
    </div>
  );
}
