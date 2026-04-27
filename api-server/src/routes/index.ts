import { Router, type IRouter } from "express";
import { requireAuth } from "../middleware/auth";
import healthRouter from "./health";
import authRouter from "./auth";
import adminRouter from "./admin";
import dashboardRouter from "./dashboard";
import clientsRouter from "./clients";
import financialRouter from "./financial";
import tasksRouter from "./tasks";
import inventoryRouter from "./inventory";
import quotesRouter from "./quotes";
import employeesRouter from "./employees";
import supportRouter from "./support";
import productSalesRouter from "./product-sales";
import commissionsRouter from "./commissions";
import settingsRouter from "./settings";
import caixaRouter from "./caixa";
import searchRouter from "./search";
import suppliersRouter from "./suppliers";
import stripeRouter from "./stripe";

const router: IRouter = Router();

// Public
router.use(healthRouter);
router.use(authRouter);
router.use(stripeRouter); // plans are public; checkout/portal check session internally

// Admin-only (mounted at /admin so requireAdmin only runs for /admin/* paths)
router.use("/admin", adminRouter);

// Protected routes (require login)
router.use(requireAuth);
router.use(dashboardRouter);
router.use(clientsRouter);
router.use(financialRouter);
router.use(tasksRouter);
router.use(inventoryRouter);
router.use(quotesRouter);
router.use(employeesRouter);
router.use(supportRouter);
router.use(productSalesRouter);
router.use(commissionsRouter);
router.use(settingsRouter);
router.use(caixaRouter);
router.use(searchRouter);
router.use(suppliersRouter);

export default router;
