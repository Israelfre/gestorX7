/**
 * Script para criar os planos do GestorX7 no Stripe.
 * 
 * Execute com:
 *   cd artifacts/api-server && npx tsx src/scripts/seed-stripe-plans.ts
 * 
 * Preços configurados (edite abaixo antes de rodar):
 *   - Mensal: R$ 97,00/mês
 *   - Anual:  R$ 970,00/ano  (~R$ 80,83/mês, economia de ~17%)
 */

import Stripe from 'stripe';

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  console.error('STRIPE_SECRET_KEY não encontrada nas variáveis de ambiente');
  process.exit(1);
}

const stripe = new Stripe(secretKey);

async function createPlans() {
  console.log('Criando planos GestorX7 no Stripe...\n');

  // Verifica se já existe
  const existing = await stripe.products.search({
    query: "name:'GestorX7' AND active:'true'",
  });

  if (existing.data.length > 0) {
    console.log('Produto GestorX7 já existe no Stripe!');
    console.log('ID:', existing.data[0].id);

    const prices = await stripe.prices.list({ product: existing.data[0].id, active: true });
    console.log('\nPreços existentes:');
    for (const p of prices.data) {
      const amount = (p.unit_amount ?? 0) / 100;
      const currency = p.currency.toUpperCase();
      const interval = p.recurring?.interval ?? 'one_time';
      console.log(`  ${p.id} — ${currency} ${amount.toFixed(2)}/${interval}`);
    }
    return;
  }

  // Cria o produto
  const product = await stripe.products.create({
    name: 'GestorX7',
    description: 'Sistema completo de gestão empresarial — Dashboard, Clientes, Financeiro, Estoque, Vendas, Orçamentos, Equipe, Agenda e mais.',
    metadata: { app: 'gestorx7' },
  });
  console.log('Produto criado:', product.id);

  // Preço mensal — R$ 97,00
  const monthly = await stripe.prices.create({
    product: product.id,
    unit_amount: 9700, // centavos BRL
    currency: 'brl',
    recurring: { interval: 'month' },
    nickname: 'Mensal GestorX7',
  });
  console.log('Preço mensal criado:', monthly.id, '— R$ 97,00/mês');

  // Preço anual — R$ 970,00
  const yearly = await stripe.prices.create({
    product: product.id,
    unit_amount: 97000, // centavos BRL
    currency: 'brl',
    recurring: { interval: 'year' },
    nickname: 'Anual GestorX7',
  });
  console.log('Preço anual criado:', yearly.id, '— R$ 970,00/ano');

  console.log('\nPlanos criados com sucesso!');
  console.log('\n⚠️  Configure o webhook no painel Stripe:');
  console.log('   Eventos: customer.subscription.created, customer.subscription.updated, customer.subscription.deleted');
}

createPlans().catch((err) => {
  console.error('Erro:', err.message);
  process.exit(1);
});
