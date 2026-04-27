import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const deliveriesTable = pgTable("deliveries", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().default(1),
  title: text("title").notNull(),
  clientId: integer("client_id"),
  clientName: text("client_name"),
  employeeId: integer("employee_id"),
  employeeName: text("employee_name"),
  status: text("status").notNull().default("pendente"),
  deliveryDate: text("delivery_date"),
  address: text("address"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Delivery = typeof deliveriesTable.$inferSelect;
