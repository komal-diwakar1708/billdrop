import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/client-utils";
import { StatusBadge } from "@/components/ui";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getInvoiceByPublicToken, recordClientView } from "@/lib/invoices";
import { formatDate, formatMoney, lineAmountCents } from "@/lib/money";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function PublicInvoicePage({ params }: PageProps<"/i/[token]">) {
  const { token } = await params;
  const db = await getDb();
  const full = await getInvoiceByPublicToken(db, token);
  if (!full) notFound();
  const { invoice, client, items, totals, status } = full;
  const viewer = await getCurrentUser();
  const isOwner = viewer?.id === invoice.userId;

  if (invoice.status === "draft" && !isOwner) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="card max-w-sm p-8 text-center">
          <p className="font-medium">This invoice isn&apos;t published yet.</p>
          <p className="mt-2 text-sm text-slate-500">Ask the sender to publish it from BillDrop.</p>
        </div>
      </main>
    );
  }
  if (!isOwner) await recordClientView(db, invoice);

  const [business] = await db.select().from(users).where(eq(users.id, invoice.userId));
  const money = (c: number) => formatMoney(c, invoice.currency);
  const payable = invoice.status === "sent";

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 print:p-0">
      {isOwner && (
        <p className="no-print mb-4 rounded-lg bg-amber-50 px-4 py-2 text-center text-sm text-amber-800">
          You&apos;re previewing your own invoice — client views are only recorded for other visitors.
        </p>
      )}
      <div className="no-print mb-4 flex items-center justify-end gap-2">
        <PrintButton />
        {payable && business?.paymentLink && (
          <a href={business.paymentLink} target="_blank" rel="noreferrer" className="btn-primary">
            Pay {money(totals.totalCents)}
          </a>
        )}
      </div>

      <article className="card print-plain p-8 sm:p-12">
        <header className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-xl font-semibold">{business?.businessName}</p>
            {business?.businessAddress && (
              <p className="mt-1 whitespace-pre-line text-sm text-slate-500">{business.businessAddress}</p>
            )}
            {business?.businessEmail && <p className="text-sm text-slate-500">{business.businessEmail}</p>}
          </div>
          <div className="text-right">
            <p className="text-3xl font-light tracking-tight text-slate-400">INVOICE</p>
            <p className="mt-1 font-medium">{invoice.number}</p>
            <div className="mt-2">
              <StatusBadge status={status === "viewed" ? "sent" : status} />
            </div>
          </div>
        </header>

        <section className="mt-10 grid gap-6 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <p className="label">Billed to</p>
            <p className="font-medium">{client?.name}</p>
            {client?.address && <p className="whitespace-pre-line text-sm text-slate-600">{client.address}</p>}
            {client?.email && <p className="text-sm text-slate-600">{client.email}</p>}
          </div>
          <div>
            <p className="label">Issued</p>
            <p className="text-sm">{formatDate(invoice.issueDate)}</p>
          </div>
          <div>
            <p className="label">Due</p>
            <p className={`text-sm ${status === "overdue" ? "font-medium text-red-600" : ""}`}>
              {formatDate(invoice.dueDate)}
            </p>
          </div>
        </section>

        <table className="mt-10 w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 font-medium">Description</th>
              <th className="py-2 text-right font-medium">Qty</th>
              <th className="py-2 text-right font-medium">Rate</th>
              <th className="py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((i) => (
              <tr key={i.id}>
                <td className="py-3 pr-4">{i.description}</td>
                <td className="py-3 text-right tabular-nums">{Number(i.quantity)}</td>
                <td className="py-3 text-right tabular-nums">{money(i.unitPriceCents)}</td>
                <td className="py-3 text-right tabular-nums">{money(lineAmountCents(i))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="ml-auto mt-6 w-full max-w-xs space-y-2 text-sm">
          <div className="flex justify-between text-slate-600">
            <dt>Subtotal</dt>
            <dd className="tabular-nums">{money(totals.subtotalCents)}</dd>
          </div>
          {totals.discountCents > 0 && (
            <div className="flex justify-between text-slate-600">
              <dt>Discount</dt>
              <dd className="tabular-nums">−{money(totals.discountCents)}</dd>
            </div>
          )}
          {Number(invoice.taxRate) > 0 && (
            <div className="flex justify-between text-slate-600">
              <dt>Tax ({Number(invoice.taxRate)}%)</dt>
              <dd className="tabular-nums">{money(totals.taxCents)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-200 pt-2 text-lg font-semibold">
            <dt>{invoice.status === "paid" ? "Paid" : "Amount due"}</dt>
            <dd className="tabular-nums">{money(totals.totalCents)}</dd>
          </div>
        </dl>

        {(invoice.notes || business?.paymentInstructions) && (
          <footer className="mt-10 grid gap-6 border-t border-slate-100 pt-6 text-sm text-slate-600 sm:grid-cols-2">
            {business?.paymentInstructions && (
              <div>
                <p className="label">How to pay</p>
                <p className="whitespace-pre-line">{business.paymentInstructions}</p>
              </div>
            )}
            {invoice.notes && (
              <div>
                <p className="label">Notes</p>
                <p className="whitespace-pre-line">{invoice.notes}</p>
              </div>
            )}
          </footer>
        )}
      </article>
      <p className="no-print mt-6 text-center text-xs text-slate-400">Sent with BillDrop</p>
    </main>
  );
}
