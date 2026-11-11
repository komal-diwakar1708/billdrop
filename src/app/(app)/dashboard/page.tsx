import Link from "next/link";
import { newBlankInvoice } from "@/app/actions/invoices";
import { AutoRefresh } from "@/components/client-utils";
import { ClaudeBadge, StatusBadge } from "@/components/ui";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { getSummary, listInvoices } from "@/lib/invoices";
import { formatDate, formatMoney } from "@/lib/money";

export default async function DashboardPage() {
  const user = await requireUser();
  const db = await getDb();
  const [rows, summary] = await Promise.all([listInvoices(db, user.id), getSummary(db, user.id)]);
  const currency = user.defaultCurrency;
  const totals = summary.currencyTotals[currency] ?? {
    outstandingCents: 0,
    overdueCents: 0,
    paidThisMonthCents: 0,
    draftCents: 0,
  };
  const otherCurrencies = Object.keys(summary.currencyTotals).filter((c) => c !== currency);

  const stats = [
    { label: "Outstanding", value: totals.outstandingCents, tone: "text-slate-900" },
    { label: "Overdue", value: totals.overdueCents, tone: "text-red-600" },
    { label: "Paid this month", value: totals.paidThisMonthCents, tone: "text-emerald-600" },
    { label: "In drafts", value: totals.draftCents, tone: "text-slate-500" },
  ];

  return (
    <div className="space-y-8">
      <AutoRefresh />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
          <p className="mt-1 text-sm text-slate-500">
            New invoices from Claude appear here automatically.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/connect" className="btn-secondary">
            ✳ Use from Claude
          </Link>
          <form action={newBlankInvoice}>
            <button className="btn-primary">New invoice</button>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{s.label}</p>
            <p className={`mt-2 text-2xl font-semibold tabular-nums ${s.tone}`}>
              {formatMoney(s.value, currency)}
            </p>
          </div>
        ))}
      </div>
      {otherCurrencies.length > 0 && (
        <p className="-mt-4 text-xs text-slate-500">
          Totals above are in {currency}. You also have invoices in {otherCurrencies.join(", ")}.
        </p>
      )}

      <div className="card overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-12 text-center">
            <p className="font-medium">No invoices yet</p>
            <p className="mt-1 text-sm text-slate-500">
              Connect Claude and try: “Invoice Acme for 3 days of design at $800/day, due in 14 days.”
            </p>
            <Link href="/connect" className="btn-primary mt-5">
              Connect Claude
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Invoice</th>
                  <th className="px-5 py-3 font-medium">Client</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Due</th>
                  <th className="px-5 py-3 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(({ invoice, client, totals: t, status }) => (
                  <tr key={invoice.id} className="group hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <Link
                        href={`/invoices/${invoice.id}`}
                        className="flex items-center gap-2 font-medium text-slate-900 group-hover:text-brand-600"
                      >
                        {invoice.number}
                        {invoice.source === "claude" && <ClaudeBadge />}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-700">{client?.name ?? "—"}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={status} />
                    </td>
                    <td className="px-5 py-3 text-slate-600">{formatDate(invoice.dueDate)}</td>
                    <td className="px-5 py-3 text-right font-medium tabular-nums">
                      {formatMoney(t.totalCents, invoice.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
