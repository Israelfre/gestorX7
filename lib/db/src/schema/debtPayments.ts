import { pgTable, serial, integer, numeric, text, timestamp } from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";

export const debtPaymentsTable = pgTable("debt_payments", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").notNull(),
  installments: integer("installments").notNull().default(1),
  notes: text("notes"),
  paidAt: timestamp("paid_at").notNull().defaultNow(),
});

export type DebtPayment = typeof debtPaymentsTable.$inferSelect;
