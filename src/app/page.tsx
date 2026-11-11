import Link from "next/link";
import { loginAsDemo } from "@/app/actions/auth";
import { Logo } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";

const steps = [
  {
    title: "Tell Claude",
    body: "“Invoice Lumen Labs for 4 days of UI design at $800/day plus $120 of stock photos, due in 14 days.” Paste an email thread or a timesheet photo — Claude does the reading.",
  },
  {
    title: "Review in BillDrop",
    body: "The draft lands in your BillDrop dashboard in seconds. Fix a line, change the due date, add your GST. Totals are always calculated exactly.",
  },
  {
    title: "Share one link. Get paid.",
    body: "Publish and send your client a live invoice page. See when they open it, flag it when it's overdue, mark it paid — or just ask Claude “who owes me money?”",
  },
];

export default async function Home() {
  const user = await getCurrentUser();
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <nav className="flex items-center gap-2">
          {user ? (
            <Link href="/dashboard" className="btn-primary">
              Open dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn-ghost">
                Log in
              </Link>
              <Link href="/signup" className="btn-primary">
                Start free
              </Link>
            </>
          )}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6">
        <section className="py-16 text-center sm:py-24">
          <p className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700">
            ✳ Works inside your own Claude — no AI fees, ever
          </p>
          <h1 className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight text-slate-900 sm:text-6xl">
            Tell Claude. <span className="text-brand-600">Get paid.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
            BillDrop is invoicing for freelancers and small studios that lives where you already work.
            Describe the job in Claude — BillDrop turns it into a live invoice your client can open,
            and keeps tracking it until the money lands.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link href="/signup" className="btn-primary px-6 py-3 text-base">
              Create free account
            </Link>
            <form action={loginAsDemo}>
              <button className="btn-secondary px-6 py-3 text-base">Try the live demo →</button>
            </form>
          </div>
        </section>

        <section className="grid gap-4 pb-16 sm:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.title} className="card p-6">
              <div className="mb-4 grid h-8 w-8 place-items-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">
                {i + 1}
              </div>
              <h3 className="font-semibold text-slate-900">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.body}</p>
            </div>
          ))}
        </section>

        <section className="card mb-20 grid gap-8 p-8 sm:grid-cols-2">
          <div>
            <h2 className="text-xl font-semibold">Why not just ask Claude?</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Claude can write an invoice. It can&apos;t host a link your client opens next week, remember
              every invoice you&apos;ve ever sent, notice who hasn&apos;t paid, or add up tax to the cent.
              BillDrop does the part that has to keep running after the chat ends.
            </p>
          </div>
          <ul className="space-y-3 text-sm text-slate-700">
            {[
              "Public invoice pages with PDF download",
              "“Viewed by client” tracking and overdue flags",
              "Exact totals, tax and discounts — computed, never guessed",
              "One dashboard for every invoice and client",
              "Zero AI inside BillDrop: your Claude plan does the thinking",
            ].map((f) => (
              <li key={f} className="flex gap-2">
                <span className="text-emerald-600">✓</span>
                {f}
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        BillDrop · Built for the Volopay Product &amp; Tech assignment
      </footer>
    </div>
  );
}
