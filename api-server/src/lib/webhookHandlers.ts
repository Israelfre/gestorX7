import { getStripeSync } from './stripeClient';
import { stripeStorage } from './stripeStorage';
import { logger } from './logger';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);

    // Custom logic: update user plan when subscription changes
    try {
      const event = JSON.parse(payload.toString());
      await WebhookHandlers.handleSubscriptionEvent(event);
    } catch (err) {
      logger.warn({ err }, 'Could not process custom subscription logic (non-fatal)');
    }
  }

  static async handleSubscriptionEvent(event: any): Promise<void> {
    const subEvents = [
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
    ];
    if (!subEvents.includes(event.type)) return;

    const subscription = event.data?.object;
    if (!subscription) return;

    const customerId = subscription.customer;
    if (!customerId) return;

    const user = await stripeStorage.getUserByStripeCustomerId(customerId);
    if (!user) {
      logger.warn({ customerId }, 'No user found for Stripe customer');
      return;
    }

    if (event.type === 'customer.subscription.deleted' || subscription.status === 'canceled') {
      logger.info({ userId: user.id }, 'Subscription canceled — plan not automatically renewed');
      return;
    }

    if (subscription.status !== 'active' && subscription.status !== 'trialing') return;

    const item = subscription.items?.data?.[0];
    const interval = item?.price?.recurring?.interval ?? item?.plan?.interval;
    const plan = interval === 'year' ? 'yearly' : 'monthly';
    const expiresAt = new Date((subscription.current_period_end ?? 0) * 1000);

    await stripeStorage.updateUserPlan(user.id, plan, expiresAt);
    await stripeStorage.updateUserStripeIds(user.id, {
      stripeSubscriptionId: subscription.id,
    });

    logger.info({ userId: user.id, plan, expiresAt }, 'User plan updated via webhook');
  }
}
