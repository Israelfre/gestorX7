import { pgTable, serial, text, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const quotesTable = pgTable("quotes", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().default(1),
  clientId: integer("client_id"),
  employeeId: integer("employee_id"),
  sellerName: text("seller_name"),
  commissionPct: numeric("commission_pct", { precision: 5, scale: 2 }).default("0"),
  commissionAmount: numeric("commission_amount", { precision: 12, scale: 2 }).default("0"),
  description: text("description").notNull(),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }),
  discount: numeric("discount", { precision: 12, scale: 2 }).default("0"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"), // 'pending' | 'converted' | 'rejected'
  additionalNotes: text("additional_notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertQuoteSchema = createInsertSchema(quotesTable).omit({ id: true, createdAt: true });
export type InsertQuote = z.infer<typeof insertQuoteSchema>;
export type Quote = typeof quotesTable.$inferSelect;
