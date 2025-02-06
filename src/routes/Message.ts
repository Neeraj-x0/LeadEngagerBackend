import { Router, Response } from "express";
import { Request } from "../types";
import { catchAsync } from "../utils/errorHandler";
import sendMessage, { sendBulkMessages } from "../utils/messageSender";
import { validate } from "../middlewares/validationMiddleware";
import { bulkMessageValidator } from "../validation/bulkMessage";
import { BulkMessageRequest } from "../types/bulkMessage";
import { getLeadsByCategoryStatus } from "../database/leads";

const router = Router();

router.post(
  "/",
  catchAsync(async (req: Request, res: Response) => {
    try {
      const { email, name } = req.user;
      const { category, body, subject } = req.body;
      const { email: leadEmail, phone: leadPhone } = req.lead;
      const result = await sendMessage(
        {
          category: category,
          body: body,
          subject: subject,
          phone: leadPhone,
          email: leadEmail,
        },
        {
          email,
          name,
        },
        req.file
      );

      return res.json(result);
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Unexpected error",
      });
    }
  })
);

router.post(
  "/bulk",
  validate(bulkMessageValidator),
  catchAsync(async (req: BulkMessageRequest, res: Response) => {
    try {
      const { email, name } = req.user;
      const { channel, body, subject, category, status } = req.body;
      const leads = await getLeadsByCategoryStatus(category, status);

      const result = await sendBulkMessages(
        {
          channel,
          body,
          subject,
          recipients: leads,
        },
        { email, name },
        req.file
      );

      return res.json(result);
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Unexpected error",
      });
    }
  })
);

