import express, { Request, Response } from "express";
import { validate } from "../middlewares/validationMiddleware";
import { catchAsync } from "../utils/errorHandler";
import {
  EngagementMessageModel,
  ReminderModel,
  CampaignModel,
} from "../models";
import {
  createEngagementMessageSchema,
  createReminderSchema,
  createCampaignSchema,
} from "../validation";

const router = express.Router();

// Engagement Message Routes
router.post(
  "/messages",
  validate(createEngagementMessageSchema),
  catchAsync(async (req: Request, res: Response) => {
    const message = await EngagementMessageModel.create(req.body);
    res.status(201).json({
      status: "success",
      data: message,
    });
  })
);

router.get(
  "/messages/:leadId",
  catchAsync(async (req: Request, res: Response) => {
    const messages = await EngagementMessageModel.find({
      leadId: req.params.leadId,
    });
    res.status(200).json({
      status: "success",
      data: messages,
    });
  })
);

// Reminder Routes
router.post(
  "/reminders",
  validate(createReminderSchema),
  catchAsync(async (req: Request, res: Response) => {
    const reminder = await ReminderModel.create(req.body);
    res.status(201).json({
      status: "success",
      data: reminder,
    });
  })
);

router.get(
  "/reminders/:leadId",
  catchAsync(async (req: Request, res: Response) => {
    const reminders = await ReminderModel.find({
      leadId: req.params.leadId,
    });
    res.status(200).json({
      status: "success",
      data: reminders,
    });
  })
);

// Campaign Routes
router.post(
  "/campaigns",
  validate(createCampaignSchema),
  catchAsync(async (req: Request, res: Response) => {
    const campaign = await CampaignModel.create(req.body);
    res.status(201).json({
      status: "success",
      data: campaign,
    });
  })
);

router.get(
  "/campaigns",
  catchAsync(async (req: Request, res: Response) => {
    const campaigns = await CampaignModel.find();
    res.status(200).json({
      status: "success",
      data: campaigns,
    });
  })
);

export default router;
