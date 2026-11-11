import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function newMcpToken(): string {
  return `bd_${nanoid(32)}`;
}
