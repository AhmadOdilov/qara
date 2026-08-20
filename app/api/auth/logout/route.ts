import { destroySession, getCurrentUser } from "@/lib/auth";
import { ok } from "@/lib/api";
import { track } from "@/lib/analytics";

export async function POST() {
  const user = await getCurrentUser();
  await destroySession();
  if (user) await track("logout", user.id);
  return ok({ ok: true });
}
