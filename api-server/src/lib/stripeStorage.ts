import { eq, sql } from 'drizzle-orm';
import { db, usersTable } from '@workspace/db';

export class StripeStorage {
  async listPlans() {
    const result = await db.execute(sql`
      SELECT
        p.id as product_id,
        p.name as product_name,
        p.description as product_description,
        p.active as product_active,
        p.metadata as product_metadata,
        pr.id as price_id,
        pr.unit_amount,
        pr.currency,
        pr.recurring,
        pr.active as price_active
      FROM stripe.products p
      LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
      WHERE p.active = true
      ORDER BY pr.unit_amount ASC
    `);
    const productsMap = new Map<string, any>();
    for (const row of result.rows as any[]) {
      if (!productsMap.has(row.product_id)) {
        productsMap.set(row.product_id, {
          id: row.product_id,
          name: row.product_name,
          description: row.product_description,
          metadata: row.product_metadata,
          prices: [],
        });
      }
      if (row.price_id) {
        productsMap.get(row.product_id).prices.push({
          id: row.price_id,
          unit_amount: row.unit_amount,
          currency: row.currency,
          recurring: row.recurring,
        });
      }
    }
    return Array.from(productsMap.values());
  }

  async getUserById(id: number) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    return user ?? null;
  }

  async getUserByStripeCustomerId(stripeCustomerId: string) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.stripeCustomerId, stripeCustomerId));
    return user ?? null;
  }

  async updateUserStripeIds(userId: number, data: { stripeCustomerId?: string; stripeSubscriptionId?: string }) {
    const [user] = await db.update(usersTable).set(data).where(eq(usersTable.id, userId)).returning();
    return user;
  }

  async updateUserPlan(userId: number, plan: 'monthly' | 'yearly', expiresAt: Date) {
    const [user] = await db.update(usersTable)
      .set({ plan, planExpiresAt: expiresAt })
      .where(eq(usersTable.id, userId))
      .returning();
    return user;
  }
}

export const stripeStorage = new StripeStorage();
