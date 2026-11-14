import { redirect } from "next/navigation";

import { getOptionalSession } from "@/lib/auth/page-guard";

// Depends on who is asking: never cached.
export const dynamic = "force-dynamic";

/**
 * The home page shows nothing itself. A signed-in user goes to the complaint
 * list; everyone else goes to the sign-in page. Both destinations are fixed.
 */
export default async function HomePage() {
  const session = await getOptionalSession();
  redirect(session ? "/complaints" : "/sign-in");
}
