import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { Db } from "./index";
import { invoices, users } from "./schema";
import { createInvoice, setInvoiceStatus } from "@/lib/invoices";
import { addDaysIso, todayIso } from "@/lib/money";
import { hashPassword, newMcpToken } from "@/lib/password";

export const DEMO_EMAIL = "demo@billdrop.app";
export const DEMO_PASSWORD = "billdrop-demo";

export async function seedDemo(db: Db) {
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, DEMO_EMAIL));
  if (existing) return;

  const userId = nanoid();
  await db.insert(users).values({
    id: userId,
    email: DEMO_EMAIL,
    passwordHash: await hashPassword(DEMO_PASSWORD),
    name: "Priya Sharma",
    businessName: "Priya Sharma Design Studio",
    businessEmail: "hello@priyasharma.design",
    businessAddress: "221 Indiranagar 100ft Road\nBengaluru 560038, India",
    paymentInstructions:
      "Bank transfer to HDFC Bank · A/C 50100123456789 · IFSC HDFC0001234\nPlease quote the invoice number as reference.",
    paymentLink: null,
    defaultCurrency: "USD",
    mcpToken: process.env.DEMO_MCP_TOKEN || newMcpToken(),
  });

  const today = todayIso();

  const paid = await createInvoice(
    db,
    userId,
    {
      client: { name: "Northwind Coffee", email: "accounts@northwind.coffee" },
      items: [
        { description: "Brand identity refresh — logo & wordmark", quantity: 1, unitPriceCents: 240000 },
        { description: "Packaging mockups", quantity: 3, unitPriceCents: 35000 },
      ],
      issueDate: addDaysIso(today, -40),
      dueInDays: 14,
      notes: "Thank you for your business!",
    },
    "manual",
  );
  await setInvoiceStatus(db, userId, paid.invoice.id, "sent", "owner");
  await setInvoiceStatus(db, userId, paid.invoice.id, "paid", "owner");

  const overdue = await createInvoice(
    db,
    userId,
    {
      client: { name: "Lumen Labs", email: "finance@lumenlabs.io" },
      items: [
        { description: "Landing page UI design", quantity: 4, unitPriceCents: 80000 },
        { description: "Stock photography licences", quantity: 1, unitPriceCents: 12000 },
      ],
      issueDate: addDaysIso(today, -21),
      dueInDays: 14,
      taxRatePercent: 0,
    },
    "claude",
  );
  await setInvoiceStatus(db, userId, overdue.invoice.id, "sent", "owner");
  await db
    .update(invoices)
    .set({ sentAt: new Date(Date.now() - 20 * 864e5), viewedAt: new Date(Date.now() - 19 * 864e5) })
    .where(eq(invoices.id, overdue.invoice.id));

  await createInvoice(
    db,
    userId,
    {
      client: { name: "Acme Robotics", email: "ap@acmerobotics.com" },
      items: [
        { description: "Product explainer illustrations", quantity: 6, unitPriceCents: 25000 },
        { description: "Revision round", quantity: 2, unitPriceCents: 15000 },
      ],
      dueInDays: 30,
      taxRatePercent: 18,
      notes: "Illustrations delivered as layered source files + PNG exports.",
    },
    "claude",
  );
}
