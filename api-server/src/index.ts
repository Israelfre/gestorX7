import app from "./app";
import { logger } from "./lib/logger";
import { ensureAdminExists } from "./lib/seed-admin";
import { runMigrations } from "stripe-replit-sync";
import { getStripeSync } from "./lib/stripeClient";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL required');
  if (!process.env.STRIPE_SECRET_KEY) {
    logger.warn('STRIPE_SECRET_KEY not set — Stripe disabled');
    return;
  }

  try {
    logger.info('Initializing Stripe schema...');
    await runMigrations({ databaseUrl, schema: 'stripe' });
    logger.info('Stripe schema ready — checkout enabled');

    // Webhook endpoint to configure manually in Stripe Dashboard:
    const domain = process.env.REPLIT_DOMAINS?.split(',')[0];
    if (domain) {
      logger.info(
        { webhookUrl: `https://${domain}/api/stripe/webhook` },
        'Register this URL as webhook endpoint in your Stripe Dashboard'
      );
    }
  } catch (err) {
    logger.warn({ err }, 'Stripe init failed (non-fatal) — payments may not work');
  }
}

await ensureAdminExists();
await initStripe();

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
});
