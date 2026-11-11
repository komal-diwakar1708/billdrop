import Link from "next/link";
import { redirect } from "next/navigation";
import { loginAsDemo } from "@/app/actions/auth";
import { LoginForm } from "@/components/auth-forms";
import { Logo } from "@/components/ui";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/db/seed";
import { getCurrentUser } from "@/lib/auth";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="card p-6">
          <h1 className="mb-6 text-lg font-semibold">Log in to BillDrop</h1>
          <LoginForm />
        </div>
        <div className="card mt-4 p-4 text-sm text-slate-600">
          <p className="font-medium text-slate-800">Reviewing the demo?</p>
          <p className="mt-1">
            Email <code className="font-mono text-slate-900">{DEMO_EMAIL}</code>
            <br />
            Password <code className="font-mono text-slate-900">{DEMO_PASSWORD}</code>
          </p>
          <form action={loginAsDemo} className="mt-3">
            <button className="btn-secondary w-full">One-click demo login</button>
          </form>
        </div>
        <p className="mt-6 text-center text-sm text-slate-600">
          New here?{" "}
          <Link href="/signup" className="font-medium text-brand-600 hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
