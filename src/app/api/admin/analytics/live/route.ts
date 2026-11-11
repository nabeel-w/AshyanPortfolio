import { getLive } from "@/features/analytics/queries";
import { auth } from "@/lib/auth";

/** Live counter for the dashboard (polled). Admin only. */
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session || session.user.role !== "ADMIN") return new Response("Unauthorized", { status: 401 });
  return Response.json(await getLive(), { headers: { "cache-control": "no-store" } });
}
