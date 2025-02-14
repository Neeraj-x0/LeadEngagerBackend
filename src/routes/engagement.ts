import express, { Response } from "express";
import { Request } from "../types";
import { EngagementModel } from "../models/engagementModel";
import { ReplyModel } from "../models/replyModel";
import {
  createEngagementSchema,
  updateEngagementSchema,
} from "../validation/engagementValidation";
import { validate } from "../middlewares/validationMiddleware";
import { engagementRequest } from "../types/engagement";
import {
  getLeadsByCategory,
} from "../database/leads";
import MailService from "../utils/mail";
import { fetchHtml } from "../database/template";
import {
  getMessageCount,
  getMessages,
} from "../database/messages";
import { isValidObjectId } from 'mongoose';
import { AppError, catchAsync } from "../utils/errorHandler";
import { UserRequest, MediaOptions, SendMessageRequest, ProcessResults } from '../utils/engagement/types';
import { parseChannels, processEmailChannel, processWhatsAppChannel, validateRequest } from "../utils/engagement/functions";
import { emailQueue, whatsappQueue } from "../workers/message";
const router = express.Router();

// Utility function to format UTC date
const getUTCDateTime = () => {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
};

// post /engagements/:id/send - Send a message to an engagement


router.post(
  '/:id/send',
  catchAsync(async (req: UserRequest, res: Response) => {
    const { id: userId } = req.user;
    const engagementId = req.params.id;

    // Validation and initial setup remain the same...
    validateRequest(req, engagementId);

    const engagement = await EngagementModel.findOne({
      _id: engagementId,
      user: userId,
    });

    if (!engagement) {
      throw new AppError('Engagement not found', 404);
    }

    const leads = await getLeadsByCategory(
      engagement.category || 'Uncategorized',
      userId
    );

    const {
      type,
      emailSubject,
      emailData,
      emailBodyType = 'html',
      mediaType = 'text',
      customHTML: initialHTML,
      message: initialMessage = '',
    } = req.body as SendMessageRequest;

    // File and message handling...
    let message: string | Buffer = initialMessage;
    const mediaOptions: MediaOptions = {};

    if (req.file) {
      message = req.file.buffer;
      mediaOptions.caption = req.body.caption;
      mediaOptions.fileName = req.file.originalname;
      mediaOptions.mimetype = req.file.mimetype;
    }

    let customHTML = initialHTML;
    if (req.body.templateId) {
      customHTML = await fetchHtml(req.body.templateId);
    }
console.log(req.body.channels)

    const channels = parseChannels(req.body.channels);
    const jobs: { channel: string; jobId: string }[] = [];

    // Queue jobs
    for (const channel of channels) {
      switch (channel) {
        case 'whatsapp': {
          const phoneLeads = leads.filter(lead => lead.phone);
          if (phoneLeads.length > 0) {

            const job = await whatsappQueue.add('whatsapp-messages', {
              leads: phoneLeads,
              message,
              mediaOptions,
              mediaType,
              userId,
              engagementId
            });
            if (job.id) {
              jobs.push({ channel: 'whatsapp', jobId: job.id });
            }
          }
          break;
        }
        case 'email': {
          const emailLeads = leads.filter(lead => lead.email);
          const mailServiceData = {
            email: req.user.email,
            name: req.user.name,
          };
          if (emailLeads.length > 0) {
            const job = await emailQueue.add('email-messages', {
              leads: emailLeads,
              emailSubject,
              customHTML: customHTML ?? '',
              emailData,
              type,
              emailBodyType,
              mailServiceData,
              file: req.file
            });
            if (job.id) {
              jobs.push({ channel: 'email', jobId: job.id });
            }
          }
          break;
        }
      }
    }



    res.status(200).json({
      status: 'success',
      message: 'Message sending initiated',
      data: {
        jobs: jobs.map(job => ({
          channel: job.channel,
          jobId: job.jobId,
          statusEndpoint: `/api/status/jobs/${job.jobId}`
        }))
      }
    });
  })
);
// POST /engagements - Create a new engagement
router.post(
  "/",
  validate(createEngagementSchema),
  catchAsync(async (req: Request, res: Response) => {
    const { id } = req.user;
    const engagement = await EngagementModel.create({
      ...req.body,
      user: id,
      timestamp: getUTCDateTime(),
      totalMessages: 0,
      replies: 0,
      messages: [],
    });

    res.status(201).json({
      status: "success",
      data: engagement,
    });
  })
);

// GET /engagements/:id - Get an engagement by ID
router.get(
  "/get/:id",
  catchAsync(async (req: Request, res: Response) => {
    const { id } = req.user;

    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid engagement ID Provided Provided",
      });
    }

    const engagement = await EngagementModel.findOne({
      user: id,
      _id: req.params.id,
    }).populate("messages");

    if (!engagement) {
      return res.status(404).json({
        status: "fail",
        message: "Engagement not found",
      });
    }

    res.status(200).json({
      status: "success",
      data: engagement,
    });
  })
);

// GET /engagements - Get all engagements with filters
router.get(
  "/",
  catchAsync(async (req: engagementRequest, res: Response) => {
    const { id } = req.user;
    const { status, category, search, startDate, endDate } = req.query;

    let query: any = { user: id };

    // Apply filters
    if (status) query.status = status;
    if (category) query.category = category;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { notes: { $regex: search, $options: "i" } },
      ];
    }
    if (startDate && endDate) {
      query.timestamp = {
        $gte: new Date(startDate as string),
        $lte: new Date(endDate as string),
      };
    }

    const engagements = await EngagementModel.find(query)
      .sort({ lastMessage: -1 })
      .populate("messages");

    res.status(200).json({
      status: "success",
      data: engagements,
    });
  })
);

// post /engagements/:id - Update an engagement
router.post(
  "/:id",
  validate(updateEngagementSchema),
  catchAsync(async (req: Request, res: Response) => {
    const { id } = req.user;

    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid engagement ID Provided",
      });
    }

    const engagement = await EngagementModel.findOneAndUpdate(
      { _id: req.params.id, user: id },
      {
        ...req.body,
        lastMessage: getUTCDateTime(),
      },
      { new: true, runValidators: true }
    ).populate("messages");

    if (!engagement) {
      return res.status(404).json({
        status: "fail",
        message: "Engagement not found",
      });
    }

    res.status(200).json({
      status: "success",
      data: engagement,
    });
  })
);

// DELETE /engagements/:id - Delete an engagement
router.delete(
  "/:id",
  catchAsync(async (req: Request, res: Response) => {
    const { id } = req.user;

    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid engagement ID Provided",
      });
    }

    const engagement = await EngagementModel.findOneAndDelete({
      _id: req.params.id,
      user: id,
    });

    if (!engagement) {
      return res.status(404).json({
        status: "fail",
        message: "Engagement not found",
      });
    }

    res.status(204).json({
      status: "success",
      data: null,
    });
  })
);

// PATCH /engagements/:id/messages - Update engagement messages
router.patch(
  "/:id/messages",
  catchAsync(async (req: Request, res: Response) => {
    const { id } = req.user;
    const { messageId, totalMessages, replies } = req.body;

    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid engagement ID Provided",
      });
    }

    const engagement = await EngagementModel.findOne({
      _id: req.params.id,
      user: id,
    });

    if (!engagement) {
      return res.status(404).json({
        status: "fail",
        message: "Engagement not found",
      });
    }

    // Update message counts if provided
    if (totalMessages !== undefined) {
      engagement.totalMessages = totalMessages;
    }
    if (replies !== undefined) {
      engagement.replies = replies;
    }

    // Add new message if provided
    if (messageId && isValidObjectId(messageId)) {
      engagement.messages.push(messageId);
    }

    engagement.lastMessage = new Date(getUTCDateTime());
    await engagement.save();

    const updatedEngagement = await EngagementModel.findById(
      engagement._id
    ).populate("messages");

    res.status(200).json({
      status: "success",
      data: updatedEngagement,
    });
  })
);

// DELETE /engagements - Bulk delete engagements
router.delete(
  "/",
  catchAsync(async (req: Request, res: Response) => {
    const { id } = req.user;
    const { ids } = req.body;

    if (!Array.isArray(ids) || !ids.every(isValidObjectId)) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid engagement ID Provideds",
      });
    }

    await EngagementModel.deleteMany({
      _id: { $in: ids },
      user: id,
    });

    res.status(204).json({
      status: "success",
      data: null,
    });
  })
);

// GET /engagements/stats - Get engagement statistics
router.get(
  "/stats",
  catchAsync(async (req: Request, res: Response) => {
    const { id } = req.user;

    const stats = await EngagementModel.aggregate([
      { $match: { user: id } },
      {
        $group: {
          _id: null,
          totalEngagements: { $sum: 1 },
          totalMessages: { $sum: "$totalMessages" },
          totalReplies: { $sum: "$replies" },
          categoryDistribution: {
            $push: "$category",
          },
          statusDistribution: {
            $push: "$status",
          },
        },
      },
    ]);

    if (stats.length === 0) {
      return res.status(200).json({
        status: "success",
        data: {
          totalEngagements: 0,
          totalMessages: 0,
          totalReplies: 0,
          categoryDistribution: {},
          statusDistribution: {},
        },
      });
    }

    // Process distributions
    const categoryCount: { [key: string]: number } = {};
    const statusCount: { [key: string]: number } = {};

    stats[0].categoryDistribution.forEach((category: string) => {
      if (category)
        categoryCount[category] = (categoryCount[category] || 0) + 1;
    });

    stats[0].statusDistribution.forEach((status: string) => {
      if (status) statusCount[status] = (statusCount[status] || 0) + 1;
    });

    res.status(200).json({
      status: "success",
      data: {
        totalEngagements: stats[0].totalEngagements,
        totalMessages: stats[0].totalMessages,
        totalReplies: stats[0].totalReplies,
        categoryDistribution: categoryCount,
        statusDistribution: statusCount,
      },
    });
  })
);

// /engagement/${engagementId}/messages
// get /engagements/:id/messages - Create a new message for an engagement

router.get(
  "/:id/replies",
  catchAsync(async (req: Request, res: Response) => {
    const { id } = req.user;

    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid engagement ID Provided",
      });
    }
    const response = await ReplyModel.find({
      engagementID: req.params.id,
      user: id,
    });

    res.status(200).json({
      status: "success",
      data: response,
    });
  })
);

router.get(
  "/:id/messages",
  catchAsync(async (req: Request, res: Response) => {
    const { id } = req.user;

    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid engagement ID Provided",
      });
    }

    const response = await getMessages({
      id,
      engagementID: req.params.id,
    });
    res.status(200).json({
      status: "success",
      data: response,
    });
  })
);

router.get(
  "/messageCount",
  catchAsync(async (req: Request, res: Response) => {
    const { id } = req.user;
    const response = await getMessageCount({ id });
    res.status(200).json({
      status: "success",
      data: response,
    });
  })
);

export default router;
