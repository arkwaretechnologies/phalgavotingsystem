import { clearAdminSession } from "@/lib/admin/session";
import { buildHtmlRedirect, getPublicOrigin } from "@/lib/http/railway-redirect";

export async function GET(req: Request) {
  await clearAdminSession();
  return buildHtmlRedirect(`${getPublicOrigin(req)}/admin/login`);
}
