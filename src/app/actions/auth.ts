"use server";

import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/db/seed";
import { endSession, startSession } from "@/lib/auth";
import { hashPassword, newMcpToken, verifyPassword } from "@/lib/password";

export type FormState = { error?: string } | undefined;

const signupSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name"),
  businessName: z.string().trim().min(1, "Please enter your business name"),
  email: z.string().trim().toLowerCase().email("Please enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function signup(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, businessName, email, password } = parsed.data;
  const db = await getDb();
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing) return { error: "An account with this email already exists. Try logging in." };
  const id = nanoid();
  await db.insert(users).values({
    id,
    email,
    name,
    businessName,
    businessEmail: email,
    passwordHash: await hashPassword(password),
    mcpToken: newMcpToken(),
  });
  await startSession(id);
  redirect("/connect?welcome=1");
}

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Wrong email or password." };
  }
  await startSession(user.id);
  redirect("/dashboard");
}

export async function loginAsDemo() {
  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.email, DEMO_EMAIL));
  if (!user || !(await verifyPassword(DEMO_PASSWORD, user.passwordHash))) redirect("/login");
  await startSession(user.id);
  redirect("/dashboard");
}

export async function logout() {
  await endSession();
  redirect("/");
}
