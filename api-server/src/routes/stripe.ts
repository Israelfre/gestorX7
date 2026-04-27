import { Router } from 'express';
import { stripeService } from '../lib/stripeService';
import { stripeStorage } from '../lib/stripeStorage';
import { getUncachableStripeClient } from '../lib/stripeClient';
import { logger } from '../lib/logger';

const router = Router();

// GET /api/stripe/plans — planos disponíveis (público)
router.get('/stripe/plans', async (_req, res) => {
  try {
    // Always query Stripe API directly to get fresh data with metadata
    const stripe = await getUncachableStripeClient();
    const [products, pricesList] = await Promise.all([
      stripe.products.list({ active: true }),
      stripe.prices.list({ active: true, expand: ['data.currency_options'] }),
    ]);
    const plans = products.data.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description ?? '',
      metadata: p.metadata,
      prices: pricesList.data
        .filter((pr) => pr.product === p.id)
        .map((pr) => ({
          id: pr.id,
          unit_amount: pr.unit_amount ?? 0,
          currency: pr.currency,
          recurring: pr.recurring,
          metadata: pr.metadata,
        })),
    }));

    res.json({ data: plans });
  } catch (err) {
    logger.error({ err }, 'Error listing plans');
    res.status(500).json({ error: 'Erro ao buscar planos' });
  }
});

// POST /api/stripe/checkout-adesao — taxa de adesão única R$97 (pagamento único)
router.post('/stripe/checkout-adesao', async (req: any, res) => {
  try {
    const { successUrl, cancelUrl } = req.body;
    if (!successUrl || !cancelUrl) {
      return res.status(400).json({ error: 'successUrl e cancelUrl são obrigatórios' });
    }

    const stripe = await getUncachableStripeClient();
    const domain = process.env.REPLIT_DOMAINS?.split(',')[0];
    const logoUrl = domain ? `https://${domain}/lp/gestorx7-logo-new.png` : undefined;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'brl',
            product_data: {
              name: 'Taxa de Adesão — GestorX7',
              description: 'Configuração inicial do sistema + suporte na implantação',
              ...(logoUrl ? { images: [logoUrl] } : {}),
            },
            unit_amount: 9700, // R$97,00
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      locale: 'pt-BR',
    });

    res.json({ url: session.url });
  } catch (err) {
    logger.error({ err }, 'Error creating adesao checkout session');
    res.status(500).json({ error: 'Erro ao criar sessão de adesão' });
  }
});

// POST /api/stripe/checkout-public — cria sessão de checkout SEM login (landing page)
router.post('/stripe/checkout-public', async (req: any, res) => {
  try {
    const { priceId, successUrl, cancelUrl, planKey } = req.body;
    if (!priceId || !successUrl || !cancelUrl) {
      return res.status(400).json({ error: 'priceId, successUrl e cancelUrl são obrigatórios' });
    }

    const stripe = await getUncachableStripeClient();

    // All plans: recurring subscription, card only
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      locale: 'pt-BR',
    });

    res.json({ url: session.url });
  } catch (err) {
    logger.error({ err }, 'Error creating public checkout session');
    res.status(500).json({ error: 'Erro ao criar sessão de checkout' });
  }
});

// POST /api/stripe/checkout — cria sessão de checkout (requer login)
router.post('/stripe/checkout', async (req: any, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: 'Não autenticado' });

    const { priceId } = req.body;
    if (!priceId) return res.status(400).json({ error: 'priceId obrigatório' });

    const user = await stripeStorage.getUserById(userId);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    const customerId = await stripeService.getOrCreateCustomer(userId, user.email, user.name);

    const domain = process.env.REPLIT_DOMAINS?.split(',')[0] ?? req.get('host');
    const baseUrl = `https://${domain}`;

    const session = await stripeService.createCheckoutSession(
      customerId,
      priceId,
      `${baseUrl}/assinatura?success=1`,
      `${baseUrl}/assinatura?canceled=1`,
    );

    res.json({ url: session.url });
  } catch (err) {
    logger.error({ err }, 'Error creating checkout session');
    res.status(500).json({ error: 'Erro ao criar sessão de checkout' });
  }
});

// POST /api/stripe/portal — portal de gerenciamento (requer login)
router.post('/stripe/portal', async (req: any, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: 'Não autenticado' });

    const user = await stripeStorage.getUserById(userId);
    if (!user?.stripeCustomerId) {
      return res.status(400).json({ error: 'Nenhuma assinatura ativa encontrada' });
    }

    const domain = process.env.REPLIT_DOMAINS?.split(',')[0] ?? req.get('host');
    const portalSession = await stripeService.createPortalSession(
      user.stripeCustomerId,
      `https://${domain}/assinatura`,
    );

    res.json({ url: portalSession.url });
  } catch (err) {
    logger.error({ err }, 'Error creating portal session');
    res.status(500).json({ error: 'Erro ao abrir portal de assinatura' });
  }
});

export default router;
