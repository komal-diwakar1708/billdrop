import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { Logo } from "@/components/ui";
import { requireUser } from "@/lib/auth";

const nav = [
  { href: "/dashboard", label: "Invoices" },
  { href: "/connect", label: "Connect Claude" },
  { href: "/settings", label: "Settings" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="flex flex-1 flex-col">
      <header className="no-print border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-8">
            <Logo href="/dashboard" />
            <nav className="hidden gap-1 sm:flex">
              {nav.map((n) => (
                <Link key={n.href} href={n.href} className="btn-ghost px-3 py-1.5">
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-slate-500 md:inline">{user.businessName}</span>
            <form action={logout}>
              <button className="btn-ghost px-3 py-1.5">Log out</button>
            </form>
          </div>
        </div>
        <nav className="flex gap-1 px-4 pb-2 sm:hidden">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="btn-ghost px-3 py-1.5 text-xs">
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
