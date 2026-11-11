"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import type { InvoiceStatus } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import {
  InvoiceError,
  createInvoice,
  deleteInvoice,
  setInvoiceStatus,
  updateInvoice,
} from "@/lib/invoices";
import { toCents } from "@/lib/money";

export type ActionResult = { ok: true } | { ok: false; error: string };

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Dates must be YYYY-MM-DD");

const editSchema = z.object({
  client: z.object({
    name: z.string().trim().min(1, "Client name is required"),
    email: z.union([z.literal(""), z.string().trim().email("Client email looks invalid")]),
    address: z.string(),
  }),
  items: z
    .array(
      z.object({
        description: z.string().trim().min(1, "Every line needs a description"),
        quantity: z.coerce.number().positive("Quantities must be greater than zero"),
        unitPrice: z.coerce.number().min(0, "Prices can't be negative"),
      }),
    )
    .min(1, "Add at least one line item"),
  currency: z.string().trim().length(3, "Currency must be a 3-letter code"),
  issueDate: isoDate,
  dueDate: isoDate,
  taxRatePercent: z.coerce.number().min(0).max(100),
  discount: z.coerce.number().min(0),
  notes: z.string(),
});

export type InvoiceEdit = z.input<typeof editSchema>;

export async function saveInvoice(id: string, input: InvoiceEdit): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = editSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const data = parsed.data;
  try {
    const db = await getDb();
    await updateInvoice(
      db,
      user.id,
      id,
      {
        client: {
          name: data.client.name,
          email: data.client.email || null,
          address: data.client.address || null,
        },
        items: data.items.map((i) => ({
          description: i.description,
          quantity: i.quantity,
          unitPriceCents: toCents(i.unitPrice),
        })),
        currency: data.currency,
        issueDate: data.issueDate,
        dueDate: data.dueDate,
        taxRatePercent: data.taxRatePercent,
        discountCents: toCents(data.discount),
        notes: data.notes || null,
      },
      "owner",
    );
  } catch (err) {
    if (err instanceof InvoiceError) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(`/invoices/${id}`);
  return { ok: true };
}

export async function changeStatus(id: string, status: InvoiceStatus): Promise<ActionResult> {
  const user = await requireUser();
  try {
    const db = await getDb();
    await setInvoiceStatus(db, user.id, id, status, "owner");
  } catch (err) {
    if (err instanceof InvoiceError) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(`/invoices/${id}`);
  return { ok: true };
}

export async function removeInvoice(id: string) {
  const user = await requireUser();
  const db = await getDb();
  await deleteInvoice(db, user.id, id);
  redirect("/dashboard");
}

export async function newBlankInvoice() {
  const user = await requireUser();
  const db = await getDb();
  const full = await createInvoice(
    db,
    user.id,
    {
      client: { name: "New client" },
      items: [{ description: "Describe your work", quantity: 1, unitPriceCents: 0 }],
    },
    "manual",
    user.defaultCurrency,
  );
  redirect(`/invoices/${full.invoice.id}`);
}
