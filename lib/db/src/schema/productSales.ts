import { pgTable, serial, integer, text, numeric, timestamp, boolean } from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";
import { employeesTable } from "./employees";

export const productSalesTable = pgTable("product_sales", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().default(1),
  clientId: integer("client_id").references(() => clientsTable.id, { onDelete: "set null" }),
  clientName: text("client_name"),
  employeeId: integer("employee_id").references(() => employeesTable.id, { onDelete: "set null" }),
  sellerName: text("seller_name"),
  commissionPct: numeric("commission_pct", { precision: 5, scale: 2 }),
  items: text("items").notNull(), // JSON: [{inventoryId, name, quantity, unitPrice, total}]
  paymentType: text("payment_type").notNull().default("avista"), // 'avista' | 'aprazo'
  paymentMethod: text("payment_method").notNull().default("dinheiro"),
  installments: integer("installments").notNull().default(1),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
  discount: numeric("discount", { precision: 12, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 12, scale: 2 }).notNull(),
  notes: text("notes"),
  returnedItems: text("returned_items"), // JSON: [{inventoryId, name, quantity, unitPrice, total}]
  returnTotal: numeric("return_total", { precision: 12, scale: 2 }),
  returnedAt: timestamp("returned_at"),
  commissionPaid: boolean("commission_paid").notNull().default(false),
  commissionPaidAt: timestamp("commission_paid_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ProductSale = typeof productSalesTable.$inferSelect;
