/**
 * Atualiza preços no Stripe para os novos valores da landing page.
 * Execute: cd artifacts/api-server && pnpm exec tsx src/scripts/update-stripe-prices.ts
 */
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const PRODUCT_ID = 'prod_UPf2tsyCmzISaf';

async function run() {
  // 1. Listar e arquivar preços antigos
  const oldPrices = await stripe.prices.list({ product: PRODUCT_ID, active: true });
  console.log(`Arquivando ${oldPrices.data.length} preço(s) antigo(s)...`);
  for (const p of oldPrices.data) {
    await stripe.prices.update(p.id, { active: false });
    console.log(`  Arquivado: ${p.id}`);
  }

  // 2. Criar novos preços
  // Mensal: R$99,90/mês
  const monthly = await stripe.prices.create({
    product: PRODUCT_ID,
    unit_amount: 9990,
    currency: 'brl',
    recurring: { interval: 'month', interval_count: 1 },
    nickname: 'Mensal GestorX7 — R$99,90/mês',
  });
  console.log('Mensal criado:', monthly.id, '— R$ 99,90/mês');

  // Semestral: R$89,90/mês × 6 = R$539,40 a cada 6 meses
  const semiannual = await stripe.prices.create({
    product: PRODUCT_ID,
    unit_amount: 53940,
    currency: 'brl',
    recurring: { interval: 'month', interval_count: 6 },
    nickname: 'Semestral GestorX7 — R$89,90/mês',
  });
  console.log('Semestral criado:', semiannual.id, '— R$ 539,40/semestre');

  // Anual: R$79,90/mês × 12 = R$958,80/ano
  const annual = await stripe.prices.create({
    product: PRODUCT_ID,
    unit_amount: 95880,
    currency: 'brl',
    recurring: { interval: 'year', interval_count: 1 },
    nickname: 'Anual GestorX7 — R$79,90/mês',
  });
  console.log('Anual criado:', annual.id, '— R$ 958,80/ano');

  console.log('\nPreços atualizados!');
}

run().catch((e) => { console.error(e.message); process.exit(1); });
