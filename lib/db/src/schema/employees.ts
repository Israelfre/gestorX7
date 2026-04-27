import { pgTable, serial, text, boolean, numeric, integer, timestamp } from "drizzle-orm/pg-core";

export const employeesTable = pgTable("employees", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().default(1),
  name: text("name").notNull(),
  role: text("role").notNull(),
  phone: text("phone").notNull().default(""),
  commissionRate: numeric("commission_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  commissionPeriod: text("commission_period").notNull().default("mensal"), // mensal | semanal | quinzenal
  commissionLimit: numeric("commission_limit", { precision: 12, scale: 2 }), // max commission per period
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Employee = typeof employeesTable.$inferSelect;
