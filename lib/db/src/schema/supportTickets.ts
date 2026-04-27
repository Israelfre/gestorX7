import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const supportTicketsTable = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().default(1),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("aberto"),
  priority: text("priority").notNull().default("media"),
  clientId: integer("client_id"),
  clientName: text("client_name"),
  assignedTo: text("assigned_to"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

export type SupportTicket = typeof supportTicketsTable.$inferSelect;
