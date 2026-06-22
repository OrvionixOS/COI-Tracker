import { Router, type IRouter } from "express";
import healthRouter from "./health";
import vendorsRouter from "./vendors";

const router: IRouter = Router();

router.use(healthRouter);
router.use(vendorsRouter);

export default router;
