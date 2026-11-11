"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { DEMO_EMAIL } from "@/db/seed";
import { requireUser } from "@/lib/auth";
import { newMcpToken } from "@/lib/password";

export type SettingsState = { error?: string; saved?: boolean } | undefined;

const settingsSchema = z.object({
  name: z.string().trim().min(1, "Your name is required"),
  businessName: z.string().trim().min(1, "Business name is required"),
  businessEmail: z.union([z.literal(""), z.string().trim().email("Business email looks invalid")]),
  businessAddress: z.string(),
  paymentInstructions: z.string(),
  paymentLink: z.union([z.literal(""), z.string().trim().url("Payment link must be a full URL")]),
  defaultCurrency: z.string().trim().length(3, "Currency must be a 3-letter code"),
});

export async function saveSettings(_: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await requireUser();
  const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const db = await getDb();
  await db
    .update(users)
    .set({
      name: d.name,
      businessName: d.businessName,
      businessEmail: d.businessEmail || null,
      businessAddress: d.businessAddress || null,
      paymentInstructions: d.paymentInstructions || null,
      paymentLink: d.paymentLink || null,
      defaultCurrency: d.defaultCurrency.toUpperCase(),
    })
    .where(eq(users.id, user.id));
  revalidatePath("/", "layout");
  return { saved: true };
}

export async function rotateMcpToken() {
  const user = await requireUser();
  if (user.email === DEMO_EMAIL) return;
  const db = await getDb();
  await db.update(users).set({ mcpToken: newMcpToken() }).where(eq(users.id, user.id));
  revalidatePath("/connect");
}
