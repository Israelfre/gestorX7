import { pgTable, serial, integer, numeric, date, text, varchar, timestamp } from "drizzle-orm/pg-core";

export const commissionPaymentsTable = pgTable("commission_payments", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  employeeId: integer("employee_id").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  paidAt: date("paid_at").notNull(),
  notes: text("notes"),
  referenceMonth: varchar("reference_month", { length: 7 }),
  createdAt: timestamp("created_at").defaultNow(),
});
