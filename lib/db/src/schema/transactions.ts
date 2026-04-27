import { pgTable, serial, text, boolean, numeric, integer, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";

export const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().default(1),
  type: text("type").notNull(), // 'income' | 'expense'
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description").notNull(),
  clientId: integer("client_id"),
  isReceivable: boolean("is_receivable").notNull().default(false),
  dueDate: date("due_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({ id: true, createdAt: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;
