import { Router, Response } from "express";
import { Request } from "../types";
import { getWeeklyEngagementData } from "../database/analytics";
import { calculatePerformanceMetrics } from "../database/metrics";
import { catchAsync } from "../utils/errorHandler";
import mongoose from "mongoose";
import { getTodayReminderTitles } from "../database/reminder";
const router = Router();

router.get(
    "/dashboard",
    catchAsync(async (req: Request, res: Response) => {
        const weekly = await getWeeklyEngagementData(new mongoose.Types.ObjectId(req.user.id));
        const metrics = await calculatePerformanceMetrics(new mongoose.Types.ObjectId(req.user.id));
        const reminder = await getTodayReminderTitles(req.user.id);
        res.json({ weekly, metrics, reminder });
    })
);



export default router;