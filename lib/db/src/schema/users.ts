import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  passwordPlain: text("password_plain"),
  role: text("role", { enum: ["admin", "client"] }).notNull().default("client"),
  plan: text("plan", { enum: ["free", "trial", "monthly", "semiannual", "yearly"] }).notNull().default("trial"),
  planExpiresAt: timestamp("plan_expires_at"),
  isActive: boolean("is_active").notNull().default(true),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type User = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;
