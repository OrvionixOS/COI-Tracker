import { Router, type IRouter } from "express";
import healthRouter from "./health";
import vendorsRouter from "./vendors";
import uploadLinksRouter from "./upload-links";

const router: IRouter = Router();

router.use(healthRouter);
router.use(vendorsRouter);
router.use(uploadLinksRouter);

export default router;
