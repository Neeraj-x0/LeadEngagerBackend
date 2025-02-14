import { Router,Request,Response } from "express";
import { AppError, catchAsync } from "../utils/errorHandler";
import { statusManager } from "../workers/message";
const router = Router();

router.get(
  '/jobs/:jobId',
  catchAsync(async (req: Request, res: Response) => {
    const { jobId } = req.params;
    const status = await statusManager.getStatus(jobId);
    
    if (!status) {
      throw new AppError('Job not found or expired', 404);
    }
    
    res.status(200).json({
      status: 'success',
      data: status
    });
  })
);

export default router;