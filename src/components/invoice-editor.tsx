"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { saveInvoice, type InvoiceEdit } from "@/app/actions/invoices";
import { computeTotals, formatMoney, lineAmountCents, toCents } from "@/lib/money";

type Item = { description: string; quantity: string; unitPrice: string };

export type EditorValues = {
  client: { name: string; email: string; address: string };
  items: Item[];
  currency: string;
  issueDate: string;
  dueDate: string;
  taxRatePercent: string;
  discount: string;
  notes: string;
};

export function InvoiceEditor({
  invoiceId,
  initial,
  locked,
}: {
  invoiceId: string;
  initial: EditorValues;
  locked: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);

  const totals = useMemo(
    () =>
      computeTotals(
        values.items.map((i) => ({
          quantity: Number(i.quantity) || 0,
          unitPriceCents: toCents(Number(i.unitPrice) || 0),
        })),
        Number(values.taxRatePercent) || 0,
        toCents(Number(values.discount) || 0),
      ),
    [values],
  );
  const currency = /^[A-Za-z]{3}$/.test(values.currency) ? values.currency.toUpperCase() : "USD";

  function set<K extends keyof EditorValues>(key: K, value: EditorValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }
  function setClient(key: keyof EditorValues["client"], value: string) {
    setValues((v) => ({ ...v, client: { ...v.client, [key]: value } }));
  }
  function setItem(index: number, key: keyof Item, value: string) {
    setValues((v) => ({
      ...v,
      items: v.items.map((it, i) => (i === index ? { ...it, [key]: value } : it)),
    }));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await saveInvoice(invoiceId, values as InvoiceEdit);
      if (result.ok) {
        setSavedAt(Date.now());
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  const disabled = locked || pending;

  return (
    <div className="card">
      <div className="grid gap-6 border-b border-slate-100 p-6 md:grid-cols-2">
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-900">Bill to</p>
          <div>
            <label className="label">Client name</label>
            <input
              className="input"
              value={values.client.name}
              disabled={disabled}
              onChange={(e) => setClient("name", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Client email</label>
            <input
              className="input"
              type="email"
              value={values.client.email}
              disabled={disabled}
              onChange={(e) => setClient("email", e.target.value)}
              placeholder="billing@client.com"
            />
          </div>
          <div>
            <label className="label">Address</label>
            <textarea
              className="input min-h-16"
              value={values.client.address}
              disabled={disabled}
              onChange={(e) => setClient("address", e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 content-start gap-3">
          <div>
            <label className="label">Issue date</label>
            <input
              className="input"
              type="date"
              value={values.issueDate}
              disabled={disabled}
              onChange={(e) => set("issueDate", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Due date</label>
            <input
              className="input"
              type="date"
              value={values.dueDate}
              disabled={disabled}
              onChange={(e) => set("dueDate", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Currency</label>
            <input
              className="input uppercase"
              maxLength={3}
              value={values.currency}
              disabled={disabled}
              onChange={(e) => set("currency", e.target.value.toUpperCase())}
            />
          </div>
          <div>
            <label className="label">Tax %</label>
            <input
              className="input"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={values.taxRatePercent}
              disabled={disabled}
              onChange={(e) => set("taxRatePercent", e.target.value)}
            />
          </div>
          <div className="col-span-2">
            <label className="label">Discount ({currency})</label>
            <input
              className="input"
              type="number"
              min={0}
              step="0.01"
              value={values.discount}
              disabled={disabled}
              onChange={(e) => set("discount", e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="hidden grid-cols-[1fr_90px_120px_120px_32px] gap-3 pb-2 text-xs font-medium uppercase tracking-wide text-slate-500 md:grid">
          <span>Description</span>
          <span>Qty</span>
          <span>Unit price</span>
          <span className="text-right">Amount</span>
          <span />
        </div>
        <div className="space-y-2">
          {values.items.map((item, index) => (
            <div
              key={index}
              className="grid grid-cols-[1fr_1fr_1fr] gap-2 rounded-lg border border-slate-100 p-2 md:grid-cols-[1fr_90px_120px_120px_32px] md:items-center md:gap-3 md:border-0 md:p-0"
            >
              <input
                className="input col-span-3 md:col-span-1"
                value={item.description}
                disabled={disabled}
                placeholder="Description"
                onChange={(e) => setItem(index, "description", e.target.value)}
              />
              <input
                className="input"
                type="number"
                min={0}
                step="0.01"
                value={item.quantity}
                disabled={disabled}
                onChange={(e) => setItem(index, "quantity", e.target.value)}
              />
              <input
                className="input"
                type="number"
                min={0}
                step="0.01"
                value={item.unitPrice}
                disabled={disabled}
                onChange={(e) => setItem(index, "unitPrice", e.target.value)}
              />
              <span className="self-center text-right text-sm font-medium tabular-nums">
                {formatMoney(
                  lineAmountCents({
                    quantity: Number(item.quantity) || 0,
                    unitPriceCents: toCents(Number(item.unitPrice) || 0),
                  }),
                  currency,
                )}
              </span>
              <button
                type="button"
                aria-label="Remove line"
                className="btn-ghost hidden px-2 py-1 text-slate-400 hover:text-red-600 md:inline-flex"
                disabled={disabled || values.items.length === 1}
                onClick={() => set("items", values.items.filter((_, i) => i !== index))}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        {!locked && (
          <button
            type="button"
            className="btn-ghost mt-3 px-3 py-1.5 text-brand-600"
            disabled={disabled}
            onClick={() =>
              set("items", [...values.items, { description: "", quantity: "1", unitPrice: "0" }])
            }
          >
            + Add line
          </button>
        )}

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div>
            <label className="label">Notes</label>
            <textarea
              className="input min-h-24"
              value={values.notes}
              disabled={disabled}
              placeholder="Thank-you note, payment terms…"
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>
          <dl className="space-y-2 self-end text-sm">
            <div className="flex justify-between text-slate-600">
              <dt>Subtotal</dt>
              <dd className="tabular-nums">{formatMoney(totals.subtotalCents, currency)}</dd>
            </div>
            {totals.discountCents > 0 && (
              <div className="flex justify-between text-slate-600">
                <dt>Discount</dt>
                <dd className="tabular-nums">−{formatMoney(totals.discountCents, currency)}</dd>
              </div>
            )}
            <div className="flex justify-between text-slate-600">
              <dt>Tax ({Number(values.taxRatePercent) || 0}%)</dt>
              <dd className="tabular-nums">{formatMoney(totals.taxCents, currency)}</dd>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatMoney(totals.totalCents, currency)}</dd>
            </div>
          </dl>
        </div>
      </div>

      {!locked && (
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-3">
          {error && <p className="mr-auto text-sm text-red-600">{error}</p>}
          {!error && savedAt && !dirty && <p className="mr-auto text-sm text-emerald-600">Saved</p>}
          {dirty && (
            <button type="button" className="btn-ghost" disabled={pending} onClick={() => setValues(initial)}>
              Discard
            </button>
          )}
          <button type="button" className="btn-primary" disabled={!dirty || pending} onClick={save}>
            {pending ? "Saving…" : "Save changes"}
          </button>
        </div>
      )}
    </div>
  );
}
