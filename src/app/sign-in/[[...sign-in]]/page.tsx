import { SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";
import Link from "next/link";

import { APP_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function SignInPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-10">
      <Link href="/" className="font-semibold tracking-tight">
        {APP_NAME}
      </Link>
      <SignIn />
    </main>
  );
}
