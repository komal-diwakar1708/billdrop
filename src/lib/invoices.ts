import { and, asc, desc, eq, ilike, or } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { Db } from "@/db";
import {
  activity,
  clients,
  invoices,
  lineItems,
  type Activity,
  type Client,
  type Invoice,
  type InvoiceSource,
  type InvoiceStatus,
  type LineItem,
} from "@/db/schema";
import { addDaysIso, computeTotals, todayIso, type Totals } from "./money";

export type Actor = Activity["actor"];

export type DisplayStatus = "draft" | "sent" | "viewed" | "overdue" | "paid" | "void";

export function displayStatus(inv: Invoice, today = todayIso()): DisplayStatus {
  if (inv.status === "paid" || inv.status === "void" || inv.status === "draft") {
    return inv.status;
  }
  if (inv.dueDate < today) return "overdue";
  if (inv.viewedAt) return "viewed";
  return "sent";
}

export type LineInput = {
  description: string;
  quantity: number;
  unitPriceCents: number;
};

export type ClientInput = {
  name: string;
  email?: string | null;
  address?: string | null;
};

export type InvoiceInput = {
  client: ClientInput;
  items: LineInput[];
  currency?: string;
  issueDate?: string;
  dueDate?: string;
  dueInDays?: number;
  taxRatePercent?: number;
  discountCents?: number;
  notes?: string | null;
};

export type InvoicePatch = Partial<Omit<InvoiceInput, "client" | "dueInDays">> & {
  client?: ClientInput;
};

export type FullInvoice = {
  invoice: Invoice;
  client: Client | null;
  items: LineItem[];
  activity: Activity[];
  totals: Totals;
  status: DisplayStatus;
};

export class InvoiceError extends Error {}

async function logActivity(db: Db, invoiceId: string, actor: Actor, message: string) {
  await db.insert(activity).values({ id: nanoid(), invoiceId, actor, message });
}

export async function findOrCreateClient(
  db: Db,
  userId: string,
  input: ClientInput,
): Promise<Client> {
  const name = input.name.trim();
  if (!name) throw new InvoiceError("Client name is required.");
  const email = input.email?.trim() || null;
  const conditions = [ilike(clients.name, name)];
  if (email) conditions.push(ilike(clients.email, email));
  const [existing] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.userId, userId), or(...conditions)))
    .limit(1);
  if (existing) {
    const updates: Partial<Client> = {};
    if (email && !existing.email) updates.email = email;
    if (input.address && !existing.address) updates.address = input.address;
    if (Object.keys(updates).length) {
      const [updated] = await db
        .update(clients)
        .set(updates)
        .where(eq(clients.id, existing.id))
        .returning();
      return updated;
    }
    return existing;
  }
  const [created] = await db
    .insert(clients)
    .values({
      id: nanoid(),
      userId,
      name,
      email,
      address: input.address?.trim() || null,
    })
    .returning();
  return created;
}

async function nextInvoiceNumber(db: Db, userId: string): Promise<string> {
  const rows = await db
    .select({ number: invoices.number })
    .from(invoices)
    .where(eq(invoices.userId, userId));
  const max = rows.reduce((m, r) => {
    const n = Number(r.number.replace(/\D/g, ""));
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return `INV-${String(max + 1).padStart(4, "0")}`;
}

function validateItems(items: LineInput[]) {
  if (!items.length) throw new InvoiceError("An invoice needs at least one line item.");
  for (const item of items) {
    if (!item.description.trim()) throw new InvoiceError("Every line item needs a description.");
    if (!(item.quantity > 0)) throw new InvoiceError("Quantities must be greater than zero.");
    if (!Number.isFinite(item.unitPriceCents)) throw new InvoiceError("Invalid unit price.");
  }
}

async function replaceItems(db: Db, invoiceId: string, items: LineInput[]) {
  await db.delete(lineItems).where(eq(lineItems.invoiceId, invoiceId));
  await db.insert(lineItems).values(
    items.map((item, position) => ({
      id: nanoid(),
      invoiceId,
      position,
      description: item.description.trim(),
      quantity: String(item.quantity),
      unitPriceCents: Math.round(item.unitPriceCents),
    })),
  );
}

export async function createInvoice(
  db: Db,
  userId: string,
  input: InvoiceInput,
  source: InvoiceSource,
  defaultCurrency = "USD",
): Promise<FullInvoice> {
  validateItems(input.items);
  const client = await findOrCreateClient(db, userId, input.client);
  const issueDate = input.issueDate ?? todayIso();
  const dueDate = input.dueDate ?? addDaysIso(issueDate, input.dueInDays ?? 14);
  if (dueDate < issueDate) throw new InvoiceError("Due date cannot be before the issue date.");
  const id = nanoid();
  await db.insert(invoices).values({
    id,
    userId,
    clientId: client.id,
    number: await nextInvoiceNumber(db, userId),
    status: "draft",
    source,
    currency: (input.currency ?? defaultCurrency).toUpperCase(),
    issueDate,
    dueDate,
    taxRate: String(input.taxRatePercent ?? 0),
    discountCents: input.discountCents ?? 0,
    notes: input.notes ?? null,
    publicToken: nanoid(21),
  });
  await replaceItems(db, id, input.items);
  await logActivity(
    db,
    id,
    source === "claude" ? "claude" : "owner",
    source === "claude" ? "Drafted by Claude" : "Created",
  );
  return (await getInvoice(db, userId, id))!;
}

export async function resolveInvoiceId(
  db: Db,
  userId: string,
  ref: string,
): Promise<string | null> {
  const trimmed = ref.trim();
  const [row] = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(
      and(
        eq(invoices.userId, userId),
        or(eq(invoices.id, trimmed), ilike(invoices.number, trimmed)),
      ),
    )
    .limit(1);
  return row?.id ?? null;
}

async function hydrate(db: Db, invoice: Invoice): Promise<FullInvoice> {
  const [client] = invoice.clientId
    ? await db.select().from(clients).where(eq(clients.id, invoice.clientId))
    : [null];
  const items = await db
    .select()
    .from(lineItems)
    .where(eq(lineItems.invoiceId, invoice.id))
    .orderBy(asc(lineItems.position));
  const events = await db
    .select()
    .from(activity)
    .where(eq(activity.invoiceId, invoice.id))
    .orderBy(desc(activity.createdAt));
  return {
    invoice,
    client: client ?? null,
    items,
    activity: events,
    totals: computeTotals(items, invoice.taxRate, invoice.discountCents),
    status: displayStatus(invoice),
  };
}

export async function getInvoice(
  db: Db,
  userId: string,
  ref: string,
): Promise<FullInvoice | null> {
  const id = await resolveInvoiceId(db, userId, ref);
  if (!id) return null;
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
  return invoice ? hydrate(db, invoice) : null;
}

export async function getInvoiceByPublicToken(
  db: Db,
  token: string,
): Promise<FullInvoice | null> {
  const [invoice] = await db.select().from(invoices).where(eq(invoices.publicToken, token));
  return invoice ? hydrate(db, invoice) : null;
}

export async function recordClientView(db: Db, invoice: Invoice) {
  if (invoice.status !== "sent" || invoice.viewedAt) return;
  await db.update(invoices).set({ viewedAt: new Date() }).where(eq(invoices.id, invoice.id));
  await logActivity(db, invoice.id, "client", "Viewed by client");
}

export type ListRow = {
  invoice: Invoice;
  client: Client | null;
  totals: Totals;
  status: DisplayStatus;
};

export async function listInvoices(db: Db, userId: string): Promise<ListRow[]> {
  const rows = await db
    .select()
    .from(invoices)
    .leftJoin(clients, eq(invoices.clientId, clients.id))
    .where(eq(invoices.userId, userId))
    .orderBy(desc(invoices.createdAt));
  if (!rows.length) return [];
  const items = await db
    .select()
    .from(lineItems)
    .innerJoin(invoices, eq(lineItems.invoiceId, invoices.id))
    .where(eq(invoices.userId, userId));
  const byInvoice = new Map<string, LineItem[]>();
  for (const { line_items } of items) {
    const list = byInvoice.get(line_items.invoiceId) ?? [];
    list.push(line_items);
    byInvoice.set(line_items.invoiceId, list);
  }
  const today = todayIso();
  return rows.map(({ invoices: invoice, clients: client }) => ({
    invoice,
    client,
    totals: computeTotals(byInvoice.get(invoice.id) ?? [], invoice.taxRate, invoice.discountCents),
    status: displayStatus(invoice, today),
  }));
}

export async function updateInvoice(
  db: Db,
  userId: string,
  ref: string,
  patch: InvoicePatch,
  actor: Actor,
): Promise<FullInvoice> {
  const current = await getInvoice(db, userId, ref);
  if (!current) throw new InvoiceError(`Invoice "${ref}" not found.`);
  if (current.invoice.status === "paid" || current.invoice.status === "void") {
    throw new InvoiceError(
      `Invoice ${current.invoice.number} is ${current.invoice.status} and can no longer be edited.`,
    );
  }
  const updates: Partial<Invoice> = { updatedAt: new Date() };
  const changed: string[] = [];
  if (patch.client) {
    const client = await findOrCreateClient(db, userId, patch.client);
    if (client.id !== current.invoice.clientId) {
      updates.clientId = client.id;
      changed.push("client");
    }
  }
  if (patch.currency) {
    updates.currency = patch.currency.toUpperCase();
    changed.push("currency");
  }
  if (patch.issueDate) {
    updates.issueDate = patch.issueDate;
    changed.push("issue date");
  }
  if (patch.dueDate) {
    updates.dueDate = patch.dueDate;
    changed.push("due date");
  }
  if (patch.taxRatePercent !== undefined) {
    updates.taxRate = String(patch.taxRatePercent);
    changed.push("tax");
  }
  if (patch.discountCents !== undefined) {
    updates.discountCents = patch.discountCents;
    changed.push("discount");
  }
  if (patch.notes !== undefined) {
    updates.notes = patch.notes;
    changed.push("notes");
  }
  const issue = updates.issueDate ?? current.invoice.issueDate;
  const due = updates.dueDate ?? current.invoice.dueDate;
  if (due < issue) throw new InvoiceError("Due date cannot be before the issue date.");
  if (patch.items) {
    validateItems(patch.items);
    await replaceItems(db, current.invoice.id, patch.items);
    changed.push("line items");
  }
  await db.update(invoices).set(updates).where(eq(invoices.id, current.invoice.id));
  if (changed.length) {
    const who = actor === "claude" ? "Claude" : "You";
    await logActivity(db, current.invoice.id, actor, `${who} edited ${changed.join(", ")}`);
  }
  return (await getInvoice(db, userId, current.invoice.id))!;
}

export async function setInvoiceStatus(
  db: Db,
  userId: string,
  ref: string,
  status: InvoiceStatus,
  actor: Actor,
): Promise<FullInvoice> {
  const current = await getInvoice(db, userId, ref);
  if (!current) throw new InvoiceError(`Invoice "${ref}" not found.`);
  const now = new Date();
  const updates: Partial<Invoice> = { status, updatedAt: now };
  let message: string;
  switch (status) {
    case "sent":
      if (current.invoice.status === "paid") {
        throw new InvoiceError(`Invoice ${current.invoice.number} is already paid.`);
      }
      updates.sentAt = current.invoice.sentAt ?? now;
      message = "Marked as sent — public link is live";
      break;
    case "paid":
      updates.paidAt = now;
      message = "Marked as paid";
      break;
    case "void":
      message = "Voided";
      break;
    case "draft":
      updates.sentAt = null;
      updates.viewedAt = null;
      updates.paidAt = null;
      message = "Moved back to draft";
      break;
  }
  await db.update(invoices).set(updates).where(eq(invoices.id, current.invoice.id));
  await logActivity(db, current.invoice.id, actor, message);
  return (await getInvoice(db, userId, current.invoice.id))!;
}

export async function deleteInvoice(db: Db, userId: string, ref: string) {
  const id = await resolveInvoiceId(db, userId, ref);
  if (!id) throw new InvoiceError(`Invoice "${ref}" not found.`);
  await db.delete(invoices).where(and(eq(invoices.id, id), eq(invoices.userId, userId)));
}

export type Summary = {
  currencyTotals: Record<
    string,
    { outstandingCents: number; overdueCents: number; paidThisMonthCents: number; draftCents: number }
  >;
  counts: Record<DisplayStatus, number>;
  overdue: ListRow[];
};

export async function getSummary(db: Db, userId: string): Promise<Summary> {
  const rows = await listInvoices(db, userId);
  const monthPrefix = todayIso().slice(0, 7);
  const counts: Summary["counts"] = { draft: 0, sent: 0, viewed: 0, overdue: 0, paid: 0, void: 0 };
  const currencyTotals: Summary["currencyTotals"] = {};
  for (const row of rows) {
    counts[row.status]++;
    const bucket = (currencyTotals[row.invoice.currency] ??= {
      outstandingCents: 0,
      overdueCents: 0,
      paidThisMonthCents: 0,
      draftCents: 0,
    });
    const total = row.totals.totalCents;
    if (row.status === "sent" || row.status === "viewed" || row.status === "overdue") {
      bucket.outstandingCents += total;
    }
    if (row.status === "overdue") bucket.overdueCents += total;
    if (row.status === "draft") bucket.draftCents += total;
    if (
      row.status === "paid" &&
      row.invoice.paidAt &&
      row.invoice.paidAt.toISOString().startsWith(monthPrefix)
    ) {
      bucket.paidThisMonthCents += total;
    }
  }
  return {
    currencyTotals,
    counts,
    overdue: rows.filter((r) => r.status === "overdue"),
  };
}

export async function listClients(db: Db, userId: string): Promise<Client[]> {
  return db.select().from(clients).where(eq(clients.userId, userId)).orderBy(asc(clients.name));
}
