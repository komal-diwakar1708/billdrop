import {
  date,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  businessName: text("business_name").notNull(),
  businessEmail: text("business_email"),
  businessAddress: text("business_address"),
  paymentInstructions: text("payment_instructions"),
  paymentLink: text("payment_link"),
  defaultCurrency: text("default_currency").notNull().default("USD"),
  mcpToken: text("mcp_token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  token: text("token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const clients = pgTable("clients", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email"),
  address: text("address"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type InvoiceStatus = "draft" | "sent" | "paid" | "void";
export type InvoiceSource = "claude" | "manual";

export const invoices = pgTable("invoices", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  clientId: text("client_id").references(() => clients.id, { onDelete: "set null" }),
  number: text("number").notNull(),
  status: text("status").$type<InvoiceStatus>().notNull().default("draft"),
  source: text("source").$type<InvoiceSource>().notNull().default("manual"),
  currency: text("currency").notNull().default("USD"),
  issueDate: date("issue_date").notNull(),
  dueDate: date("due_date").notNull(),
  taxRate: numeric("tax_rate", { precision: 6, scale: 3 }).notNull().default("0"),
  discountCents: integer("discount_cents").notNull().default(0),
  notes: text("notes"),
  publicToken: text("public_token").notNull().unique(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  viewedAt: timestamp("viewed_at", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const lineItems = pgTable("line_items", {
  id: text("id").primaryKey(),
  invoiceId: text("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
  unitPriceCents: integer("unit_price_cents").notNull(),
});

export const activity = pgTable("activity", {
  id: text("id").primaryKey(),
  invoiceId: text("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
  actor: text("actor").$type<"claude" | "owner" | "client" | "system">().notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type LineItem = typeof lineItems.$inferSelect;
export type Activity = typeof activity.$inferSelect;
