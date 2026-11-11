import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { Db } from "@/db";
import type { User } from "@/db/schema";
import {
  InvoiceError,
  createInvoice,
  getInvoice,
  getSummary,
  listClients,
  listInvoices,
  setInvoiceStatus,
  updateInvoice,
  type FullInvoice,
  type LineInput,
} from "@/lib/invoices";
import { formatDate, formatMoney, fromCents, lineAmountCents, toCents } from "@/lib/money";

const INSTRUCTIONS = `BillDrop is the user's invoicing app. It stores, edits, publishes and tracks invoices.
- You do the reading and writing (e.g. turn an email, chat, timesheet or photo into line items); BillDrop computes all totals.
- Money amounts you send are in major units of the currency (800 means $800.00), never cents.
- New invoices are created as drafts. Always share the edit_url so the user can review it in BillDrop.
- Only call send_invoice when the user explicitly asks to send/publish/share; only call mark_invoice_paid when they say it was paid.
- Refer to invoices by their number (e.g. INV-0003).`;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .describe("Date in YYYY-MM-DD format");

const clientSchema = z.object({
  name: z.string().min(1).describe("Client or company name, e.g. 'Acme Corp'"),
  email: z.string().email().optional().describe("Billing email of the client, if known"),
  address: z.string().optional().describe("Client billing address, multi-line allowed"),
});

const itemSchema = z.object({
  description: z.string().min(1).describe("What was delivered, e.g. 'Logo design — 3 concepts'"),
  quantity: z.number().positive().describe("Quantity, hours or days. Decimals allowed (e.g. 2.5)"),
  unit_price: z
    .number()
    .min(0)
    .describe("Price per unit in major currency units, e.g. 800 for $800.00"),
});

const invoiceRef = z
  .string()
  .min(1)
  .describe("Invoice number like 'INV-0003' (preferred) or invoice id");

function toLines(items: z.infer<typeof itemSchema>[]): LineInput[] {
  return items.map((i) => ({
    description: i.description,
    quantity: i.quantity,
    unitPriceCents: toCents(i.unit_price),
  }));
}

function links(baseUrl: string, full: FullInvoice) {
  return {
    edit_url: `${baseUrl}/invoices/${full.invoice.id}`,
    public_url: `${baseUrl}/i/${full.invoice.publicToken}`,
  };
}

function invoiceJson(baseUrl: string, full: FullInvoice) {
  const { invoice, client, items, totals } = full;
  return {
    number: invoice.number,
    id: invoice.id,
    status: full.status,
    client: client ? { name: client.name, email: client.email } : null,
    currency: invoice.currency,
    issue_date: invoice.issueDate,
    due_date: invoice.dueDate,
    items: items.map((i) => ({
      description: i.description,
      quantity: Number(i.quantity),
      unit_price: fromCents(i.unitPriceCents),
      amount: fromCents(lineAmountCents(i)),
    })),
    subtotal: fromCents(totals.subtotalCents),
    discount: fromCents(totals.discountCents),
    tax_rate_percent: Number(invoice.taxRate),
    tax: fromCents(totals.taxCents),
    total: fromCents(totals.totalCents),
    notes: invoice.notes,
    ...links(baseUrl, full),
  };
}

function invoiceText(baseUrl: string, full: FullInvoice, headline: string) {
  const { invoice, client, totals } = full;
  const { edit_url, public_url } = links(baseUrl, full);
  const lines = [
    headline,
    `${invoice.number} · ${client?.name ?? "No client"} · ${formatMoney(totals.totalCents, invoice.currency)} · ${full.status}`,
    `Due ${formatDate(invoice.dueDate)}`,
    `Review & edit: ${edit_url}`,
  ];
  if (invoice.status !== "draft") lines.push(`Client link: ${public_url}`);
  return lines.join("\n");
}

function ok(text: string, data: unknown): CallToolResult {
  return {
    content: [
      { type: "text", text },
      { type: "text", text: JSON.stringify(data, null, 2) },
    ],
  };
}

function fail(err: unknown): CallToolResult {
  const message =
    err instanceof InvoiceError ? err.message : "Something went wrong in BillDrop. Please try again.";
  if (!(err instanceof InvoiceError)) console.error("MCP tool error:", err);
  return { isError: true, content: [{ type: "text", text: message }] };
}

export function buildMcpServer(db: Db, user: User, baseUrl: string): McpServer {
  const server = new McpServer(
    { name: "billdrop", title: "BillDrop Invoices", version: "1.0.0" },
    { instructions: INSTRUCTIONS },
  );

  server.registerTool(
    "create_invoice",
    {
      title: "Create invoice",
      description:
        "Create a new draft invoice in BillDrop for a client. Use this when the user wants to bill someone. Extract the client, line items, currency, dates and tax from the conversation, documents or images. Returns the invoice with an edit link for the user to review.",
      inputSchema: {
        client: clientSchema,
        items: z.array(itemSchema).min(1).describe("Line items to bill"),
        currency: z
          .string()
          .length(3)
          .optional()
          .describe(`ISO 4217 currency code. Defaults to ${user.defaultCurrency}`),
        issue_date: isoDate.optional().describe("Issue date (YYYY-MM-DD). Defaults to today"),
        due_date: isoDate.optional().describe("Due date (YYYY-MM-DD). Takes precedence over due_in_days"),
        due_in_days: z.number().int().min(0).max(365).optional().describe("Payment terms in days. Default 14"),
        tax_rate_percent: z.number().min(0).max(100).optional().describe("Tax/VAT/GST percent, e.g. 18"),
        discount: z.number().min(0).optional().describe("Flat discount in major currency units"),
        notes: z.string().optional().describe("Notes shown on the invoice, e.g. thank-you or terms"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args) => {
      try {
        const full = await createInvoice(
          db,
          user.id,
          {
            client: args.client,
            items: toLines(args.items),
            currency: args.currency,
            issueDate: args.issue_date,
            dueDate: args.due_date,
            dueInDays: args.due_in_days,
            taxRatePercent: args.tax_rate_percent,
            discountCents: args.discount !== undefined ? toCents(args.discount) : undefined,
            notes: args.notes,
          },
          "claude",
          user.defaultCurrency,
        );
        return ok(invoiceText(baseUrl, full, "Draft invoice created in BillDrop."), invoiceJson(baseUrl, full));
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "update_invoice",
    {
      title: "Update invoice",
      description:
        "Edit an existing draft or sent invoice. Only pass the fields that change. Passing `items` replaces ALL line items, so include the full list.",
      inputSchema: {
        invoice: invoiceRef,
        client: clientSchema.optional().describe("Move the invoice to this client"),
        items: z.array(itemSchema).min(1).optional().describe("Full replacement list of line items"),
        currency: z.string().length(3).optional(),
        issue_date: isoDate.optional(),
        due_date: isoDate.optional(),
        tax_rate_percent: z.number().min(0).max(100).optional(),
        discount: z.number().min(0).optional().describe("Flat discount in major currency units"),
        notes: z.string().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      try {
        const full = await updateInvoice(
          db,
          user.id,
          args.invoice,
          {
            client: args.client,
            items: args.items ? toLines(args.items) : undefined,
            currency: args.currency,
            issueDate: args.issue_date,
            dueDate: args.due_date,
            taxRatePercent: args.tax_rate_percent,
            discountCents: args.discount !== undefined ? toCents(args.discount) : undefined,
            notes: args.notes,
          },
          "claude",
        );
        return ok(invoiceText(baseUrl, full, "Invoice updated."), invoiceJson(baseUrl, full));
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "get_invoice",
    {
      title: "Get invoice",
      description: "Fetch full details of one invoice: client, line items, totals, status and links.",
      inputSchema: { invoice: invoiceRef },
      annotations: { readOnlyHint: true },
    },
    async ({ invoice }) => {
      try {
        const full = await getInvoice(db, user.id, invoice);
        if (!full) throw new InvoiceError(`Invoice "${invoice}" not found.`);
        return ok(invoiceText(baseUrl, full, `Invoice ${full.invoice.number}`), invoiceJson(baseUrl, full));
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "list_invoices",
    {
      title: "List invoices",
      description:
        "List the user's invoices, newest first. Filter by status (draft, sent, viewed, overdue, paid, void, or 'unpaid' for sent+viewed+overdue) and/or client name.",
      inputSchema: {
        status: z
          .enum(["all", "unpaid", "draft", "sent", "viewed", "overdue", "paid", "void"])
          .optional()
          .describe("Default 'all'"),
        client: z.string().optional().describe("Case-insensitive client name filter"),
        limit: z.number().int().min(1).max(100).optional().describe("Default 25"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ status = "all", client, limit = 25 }) => {
      try {
        let rows = await listInvoices(db, user.id);
        if (status === "unpaid") {
          rows = rows.filter((r) => ["sent", "viewed", "overdue"].includes(r.status));
        } else if (status !== "all") {
          rows = rows.filter((r) => r.status === status);
        }
        if (client) {
          const needle = client.toLowerCase();
          rows = rows.filter((r) => r.client?.name.toLowerCase().includes(needle));
        }
        rows = rows.slice(0, limit);
        const data = rows.map((r) => ({
          number: r.invoice.number,
          client: r.client?.name ?? null,
          status: r.status,
          total: fromCents(r.totals.totalCents),
          currency: r.invoice.currency,
          issue_date: r.invoice.issueDate,
          due_date: r.invoice.dueDate,
          edit_url: `${baseUrl}/invoices/${r.invoice.id}`,
        }));
        const text = rows.length
          ? rows
              .map(
                (r) =>
                  `${r.invoice.number} · ${r.client?.name ?? "—"} · ${formatMoney(r.totals.totalCents, r.invoice.currency)} · ${r.status} · due ${r.invoice.dueDate}`,
              )
              .join("\n")
          : "No invoices match.";
        return ok(text, data);
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "send_invoice",
    {
      title: "Send / publish invoice",
      description:
        "Mark an invoice as sent and make its public client link live. Returns the link to share with the client. Only call when the user asks to send, publish or share the invoice.",
      inputSchema: { invoice: invoiceRef },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ invoice }) => {
      try {
        const full = await setInvoiceStatus(db, user.id, invoice, "sent", "claude");
        return ok(
          invoiceText(baseUrl, full, "Invoice is live. Share the client link below."),
          invoiceJson(baseUrl, full),
        );
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "mark_invoice_paid",
    {
      title: "Mark invoice paid",
      description: "Record that the client has paid an invoice in full.",
      inputSchema: { invoice: invoiceRef },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ invoice }) => {
      try {
        const full = await setInvoiceStatus(db, user.id, invoice, "paid", "claude");
        return ok(invoiceText(baseUrl, full, "Marked as paid."), invoiceJson(baseUrl, full));
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "get_business_summary",
    {
      title: "Money summary",
      description:
        "Answer 'who owes me money?' — outstanding, overdue and paid-this-month totals per currency, invoice counts by status and the list of overdue invoices.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      try {
        const summary = await getSummary(db, user.id);
        const lines: string[] = [];
        for (const [currency, t] of Object.entries(summary.currencyTotals)) {
          lines.push(
            `${currency}: outstanding ${formatMoney(t.outstandingCents, currency)}, overdue ${formatMoney(t.overdueCents, currency)}, paid this month ${formatMoney(t.paidThisMonthCents, currency)}, in drafts ${formatMoney(t.draftCents, currency)}`,
          );
        }
        if (summary.overdue.length) {
          lines.push("Overdue:");
          for (const r of summary.overdue) {
            lines.push(
              `- ${r.invoice.number} ${r.client?.name ?? ""} ${formatMoney(r.totals.totalCents, r.invoice.currency)} (due ${r.invoice.dueDate})`,
            );
          }
        }
        const data = {
          totals: Object.fromEntries(
            Object.entries(summary.currencyTotals).map(([c, t]) => [
              c,
              {
                outstanding: fromCents(t.outstandingCents),
                overdue: fromCents(t.overdueCents),
                paid_this_month: fromCents(t.paidThisMonthCents),
                drafts: fromCents(t.draftCents),
              },
            ]),
          ),
          counts: summary.counts,
          overdue: summary.overdue.map((r) => ({
            number: r.invoice.number,
            client: r.client?.name,
            client_email: r.client?.email,
            total: fromCents(r.totals.totalCents),
            currency: r.invoice.currency,
            due_date: r.invoice.dueDate,
            public_url: `${baseUrl}/i/${r.invoice.publicToken}`,
          })),
        };
        return ok(lines.join("\n") || "No invoices yet.", data);
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "list_clients",
    {
      title: "List clients",
      description: "List the user's saved clients with their billing emails.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      try {
        const rows = await listClients(db, user.id);
        const data = rows.map((c) => ({ name: c.name, email: c.email, address: c.address }));
        const text = rows.length
          ? rows.map((c) => `${c.name}${c.email ? ` <${c.email}>` : ""}`).join("\n")
          : "No clients yet.";
        return ok(text, data);
      } catch (err) {
        return fail(err);
      }
    },
  );

  return server;
}
