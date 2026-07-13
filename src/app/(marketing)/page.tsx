import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

/**
 * Opening the site drops you straight into chat, like ChatGPT:
 * signed-in users get their workspace, visitors get the guest trial.
 * The marketing landing page remains available at /home.
 */
export default async function RootPage() {
  const { userId } = await auth();
  redirect(userId ? "/chat" : "/try");
}
