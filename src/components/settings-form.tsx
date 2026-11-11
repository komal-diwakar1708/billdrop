"use client";

import { useActionState } from "react";
import { saveSettings } from "@/app/actions/settings";
import type { User } from "@/db/schema";

export type SettingsValues = Pick<
  User,
  | "name"
  | "businessName"
  | "businessEmail"
  | "businessAddress"
  | "paymentInstructions"
  | "paymentLink"
  | "defaultCurrency"
>;

export function SettingsForm({ user }: { user: SettingsValues }) {
  const [state, action, pending] = useActionState(saveSettings, undefined);
  return (
    <form action={action} className="card space-y-5 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="name">Your name</label>
          <input id="name" name="name" className="input" defaultValue={user.name} required />
        </div>
        <div>
          <label className="label" htmlFor="businessName">Business name</label>
          <input id="businessName" name="businessName" className="input" defaultValue={user.businessName} required />
        </div>
        <div>
          <label className="label" htmlFor="businessEmail">Business email (shown on invoices)</label>
          <input id="businessEmail" name="businessEmail" type="email" className="input" defaultValue={user.businessEmail ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="defaultCurrency">Default currency</label>
          <input id="defaultCurrency" name="defaultCurrency" className="input uppercase" maxLength={3} defaultValue={user.defaultCurrency} required />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="businessAddress">Business address</label>
        <textarea id="businessAddress" name="businessAddress" className="input min-h-20" defaultValue={user.businessAddress ?? ""} />
      </div>
      <div>
        <label className="label" htmlFor="paymentInstructions">Payment instructions</label>
        <textarea
          id="paymentInstructions"
          name="paymentInstructions"
          className="input min-h-20"
          placeholder="Bank name, account number, IFSC/SWIFT, UPI ID…"
          defaultValue={user.paymentInstructions ?? ""}
        />
      </div>
      <div>
        <label className="label" htmlFor="paymentLink">Payment link (Stripe, PayPal, Razorpay…)</label>
        <input
          id="paymentLink"
          name="paymentLink"
          type="url"
          className="input"
          placeholder="https://buy.stripe.com/…"
          defaultValue={user.paymentLink ?? ""}
        />
        <p className="mt-1 text-xs text-slate-500">Adds a “Pay” button to every published invoice.</p>
      </div>
      <div className="flex items-center justify-end gap-3">
        {state?.error && <p className="mr-auto text-sm text-red-600">{state.error}</p>}
        {state?.saved && <p className="mr-auto text-sm text-emerald-600">Saved</p>}
        <button className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </button>
      </div>
    </form>
  );
}
