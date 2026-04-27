import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pinoHttp from "pino-http";
import pg from "pg";
import router from "./routes";
import { logger } from "./lib/logger";
import { WebhookHandlers } from "./lib/webhookHandlers";
import "./types/session.d.ts";

const PgSession = connectPgSimple(session);

const app: Express = express();

// ⚠️ Stripe webhook MUST be registered BEFORE express.json() — needs raw Buffer
app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    const signature = req.headers['stripe-signature'];
    if (!signature) {
      res.status(400).json({ error: 'Missing stripe-signature header' });
      return;
    }
    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (err: any) {
      logger.error({ err }, 'Stripe webhook error');
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

const sessionMiddleware = session({
  store: new PgSession({
    conString: process.env.DATABASE_URL,
    tableName: "sessions",
  }),
  name: "gx7.sid",
  secret: process.env.SESSION_SECRET || "gestorx7-secret-key",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
});

app.use(sessionMiddleware);

// Middleware: se não há sessão via cookie, tenta carregar pelo X-Auth-Token header
const pgPool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

app.use(async (req: Request, res: Response, next: NextFunction) => {
  if (req.session?.userId) {
    next();
    return;
  }

  const token = req.headers["x-auth-token"] as string | undefined;
  if (!token) {
    next();
    return;
  }

  try {
    const result = await pgPool.query(
      "SELECT sess FROM sessions WHERE sid = $1 AND expire > NOW()",
      [token]
    );
    if (result.rows.length > 0) {
      const sessData = result.rows[0].sess;
      req.session.userId = sessData.userId;
      req.session.tenantId = sessData.tenantId;
      req.session.role = sessData.role;
      req.session.name = sessData.name;
      req.session.email = sessData.email;
      req.session.plan = sessData.plan;
      req.session.planExpiresAt = sessData.planExpiresAt;
    }
  } catch (e) {
    // silently ignore
  }

  next();
});

app.use("/api", router);

export default app;
