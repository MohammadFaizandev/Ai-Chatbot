import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Next.js 16 proxy (successor of middleware.ts) running Clerk auth.
 * The landing page, sign-in, and sign-up stay public; the chat app and all
 * chat APIs require an authenticated session.
 */
const isProtectedRoute = createRouteMatcher([
  "/chat(.*)",
  "/images(.*)",
  "/api/chat(.*)",
  "/api/image(.*)",
  "/api/conversations(.*)",
  "/api/attachments(.*)",
  "/api/usage(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
