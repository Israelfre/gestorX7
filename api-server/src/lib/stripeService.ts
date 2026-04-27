import { getUncachableStripeClient } from './stripeClient';
import { stripeStorage } from './stripeStorage';

export class StripeService {
  async getOrCreateCustomer(userId: number, email: string, name: string) {
    const stripe = await getUncachableStripeClient();
    const user = await stripeStorage.getUserById(userId);

    if (user?.stripeCustomerId) {
      return user.stripeCustomerId;
    }

    const customer = await stripe.customers.create({
      email,
      name,
      metadata: { userId: String(userId) },
    });

    await stripeStorage.updateUserStripeIds(userId, { stripeCustomerId: customer.id });
    return customer.id;
  }

  async createCheckoutSession(customerId: string, priceId: string, successUrl: string, cancelUrl: string) {
    const stripe = await getUncachableStripeClient();
    return await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
  }

  async createPortalSession(customerId: string, returnUrl: string) {
    const stripe = await getUncachableStripeClient();
    return await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
  }
}

export const stripeService = new StripeService();
