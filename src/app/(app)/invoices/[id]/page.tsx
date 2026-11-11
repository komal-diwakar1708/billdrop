import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/client-utils";
import { InvoiceActions } from "@/components/invoice-actions";
import { InvoiceEditor, type EditorValues } from "@/components/invoice-editor";
import { ClaudeBadge, StatusBadge } from "@/components/ui";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { getInvoice } from "@/lib/invoices";
import { formatDate, fromCents } from "@/lib/money";
import { baseUrlFromHeaders } from "@/lib/url";

const ACTOR_DOT: Record<string, string> = {
  claude: "bg-orange-400",
  owner: "bg-brand-500",
  client: "bg-violet-500",
  system: "bg-slate-400",
};

export default async function InvoicePage({ params }: PageProps<"/invoices/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  const db = await getDb();
  const full = await getInvoice(db, user.id, id);
  if (!full) notFound();
  const { invoice, client, items, activity, status } = full;
  const publicUrl = `${baseUrlFromHeaders(await headers())}/i/${invoice.publicToken}`;

  const initial: EditorValues = {
    client: {
      name: client?.name ?? "",
      email: client?.email ?? "",
      address: client?.address ?? "",
    },
    items: items.map((i) => ({
      description: i.description,
      quantity: String(Number(i.quantity)),
      unitPrice: String(fromCents(i.unitPriceCents)),
    })),
    currency: invoice.currency,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    taxRatePercent: String(Number(invoice.taxRate)),
    discount: String(fromCents(invoice.discountCents)),
    notes: invoice.notes ?? "",
  };

  return (
    <div className="space-y-6">
      <AutoRefresh intervalMs={5000} />
      <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-900">
        ← All invoices
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{invoice.number}</h1>
            <StatusBadge status={status} />
            {invoice.source === "claude" && <ClaudeBadge />}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {client?.name ?? "No client"} · issued {formatDate(invoice.issueDate)} · due{" "}
            {formatDate(invoice.dueDate)}
          </p>
        </div>
        <InvoiceActions invoiceId={invoice.id} status={invoice.status} publicUrl={publicUrl} />
      </div>

      {invoice.status !== "draft" && (
        <div className="card flex flex-wrap items-center gap-3 p-4 text-sm">
          <span className="font-medium text-slate-700">Client link</span>
          <code className="min-w-0 flex-1 truncate rounded bg-slate-50 px-2 py-1 font-mono text-xs text-slate-600">
            {publicUrl}
          </code>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <InvoiceEditor
          key={invoice.updatedAt.toISOString()}
          invoiceId={invoice.id}
          initial={initial}
          locked={invoice.status === "paid" || invoice.status === "void"}
        />
        <aside className="card h-fit p-5">
          <h2 className="mb-4 text-sm font-semibold">Activity</h2>
          <ol className="space-y-4">
            {activity.map((a) => (
              <li key={a.id} className="flex gap-3 text-sm">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${ACTOR_DOT[a.actor]}`} />
                <div>
                  <p className="text-slate-800">{a.message}</p>
                  <p className="text-xs text-slate-500">
                    {a.createdAt.toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  );
}
