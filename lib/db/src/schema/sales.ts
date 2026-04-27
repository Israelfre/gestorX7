import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { employeesTable } from "./employees";

export const salesTable = pgTable("sales", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().default(1),
  employeeId: integer("employee_id").notNull().references(() => employeesTable.id, { onDelete: "cascade" }),
  clientId: integer("client_id"),
  clientName: text("client_name"),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  commissionPct: numeric("commission_pct", { precision: 5, scale: 2 }).notNull().default("0"),
  commissionAmount: numeric("commission_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("pendente"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Sale = typeof salesTable.$inferSelect;
