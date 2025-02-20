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
import MailService from "../services/Email";
import { fetchHtml } from "../database/template";
import {
  getMessageCount,
  getMessages,
} from "../database/messages";
import { isValidObjectId } from 'mongoose';
import { AppError, catchAsync } from "../utils/errorHandler";
import { UserRequest, MediaOptions, SendMessageRequest, ProcessResults } from '../utils/engagement/types';
import { parseChannels, processEmailChannel, processWhatsAppChannel, validateRequest } from "../utils/engagement/functions";
import { emailQueue, posterQueue, whatsappQueue } from "../workers/message";
import { LeadModel } from "../models/LeadModel";
import mongoose from "mongoose";
import Media from "../models/Media";
const router = express.Router();

// Utility function to format UTC date
const getUTCDateTime = () => {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
};


router.post(
  '/:id/send',
  catchAsync(async (req: UserRequest, res: Response) => {
    const { id: userId } = req.user;
    const engagementId = req.params.id;

    // Validate request and engagement existence
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

    if (emailData) {
      emailData.from = userId;
      emailData.engagementID = engagementId;
    }

    // File and message handling
    let message: string | Buffer = initialMessage;
    const mediaOptions: { [key: string]: any } = {};
    let file: Express.Multer.File | undefined;

    // Extract first available file from req.files if provided.
    if (req.files) {
      if (Array.isArray(req.files)) {
        file = req.files[0];
      } else {
        // req.files is an object; get the array from the first key that has files.
        const fileFields = Object.values(req.files);
        if (fileFields.length > 0 && Array.isArray(fileFields[0]) && fileFields[0].length > 0) {
          file = fileFields[0][0];
        }
      }

      // If file exists, update message and mediaOptions accordingly.
      if (file) {
        message = file.buffer ? Buffer.from(file.buffer) : '';
        mediaOptions.caption = req.body.caption;
        mediaOptions.fileName = file.originalname;
        mediaOptions.mimetype = file.mimetype;
      }
    }

    // Use provided template HTML if templateId is sent.
    let customHTML = initialHTML;
    if (req.body.templateId) {
      customHTML = await fetchHtml(req.body.templateId);
    }

    const channels = parseChannels(req.body.channels);
    const jobs: { channel: string; jobId: string }[] = [];
    console.log('Channels:', channels);

    // Process and queue jobs for each channel.
    for (const channel of channels) {
      if (channel === 'whatsapp') {
        const phoneLeads = leads.filter((lead: any) => lead.phone);
        if (phoneLeads.length > 0) {
          if (req.body.poster) {
            let posterDataInput;
            try {
              // If poster data is a JSON string, parse it.
              posterDataInput = typeof req.body.poster === 'string' ? JSON.parse(req.body.poster) : req.body.poster;
            } catch (err) {
              throw new AppError('Invalid poster data format', 400);
            }
            const { title, note } = posterDataInput;
            const whatsappData = {
              leads: phoneLeads,
              message,
              mediaOptions,
              mediaType,
              userId,
              engagementId,
            };

            // Extract additional files for the poster (icon and background).
            let iconBuffer: Buffer | null = null;
            let backgroundBuffer: Buffer | null = null;
            let filesArray: Express.Multer.File[] = [];
            if (req.files) {
              if (Array.isArray(req.files)) {
                filesArray = req.files;
              } else {
                // Flatten file arrays from req.files object.
                filesArray = Object.values(req.files).flat();
              }
            }
            const iconFile = filesArray.find(file => file.fieldname === 'icon');
            const backgroundFile = filesArray.find(file => file.fieldname === 'background');

            if (iconFile && iconFile.buffer) {
              iconBuffer = Buffer.from(iconFile.buffer);
            }
            if (backgroundFile && backgroundFile.buffer) {
              backgroundBuffer = Buffer.from(backgroundFile.buffer);
            }
            if (!iconBuffer) {
              throw new AppError('Poster icon is required', 400);
            }

            const iconId = await Media.create({ file: iconBuffer }).then(media => media._id);
            let backgroundId;
            if (backgroundBuffer) {
              backgroundId = await Media.create({ file: backgroundBuffer }).then(media => media._id);
            }
            const posterData = {
              title,
              note,
              iconId,
              ...(backgroundId && { backgroundId }),
            };

            const job = await posterQueue.add('poster-messages', {
              whatsappData,
              posterData,
            });
            if (job.id) {
              jobs.push({ channel: 'whatsapp', jobId: job.id });
            }
          } else {
            const job = await whatsappQueue.add('whatsapp-messages', {
              leads: phoneLeads,
              message,
              mediaOptions,
              mediaType,
              userId,
              engagementId,
            });
            if (job.id) {
              jobs.push({ channel: 'whatsapp', jobId: job.id });
            }
          }
        }
      } else if (channel === 'email') {
        const emailLeads = leads.filter((lead: any) => lead.email);
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
            file,
          });
          if (job.id) {
            jobs.push({ channel: 'email', jobId: job.id });
          }
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
    const { id: userId } = req.user;
    const { id: engagementId } = req.params;

    if (!isValidObjectId(engagementId)) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid engagement ID Provided",
      });
    }

    // Get all replies with populated message and lead data
    const replies = await ReplyModel.find({
      engagementID: engagementId,
      user: userId,
    })
      .populate('messageID', 'content type source createdAt')
      .populate<{ messageID: any, lead: { name: string, email: string, phone: string, _id: mongoose.Types.ObjectId } }>({
        path: 'lead',
        model: LeadModel,
        select: 'name email phone'
      })
      .sort({ replyDate: -1 });
    let leadinfo



    // Transform the data for frontend consumption
    const formattedReplies = replies.map(reply => ({

      id: reply._id,
      messageId: reply.messageID._id,
      leadInfo: reply.lead ? {
        id: reply.lead._id,
        name: reply.lead.name,
        email: reply.lead.email,
        phone: reply.lead.phone
      } : {
        id: "",
        name: "",
        email: "",
        phone: ""
      },
      timestamp: reply.replyDate,
      source: "whatsapp",
      messageType: reply.messageID.type
    }));

    res.status(200).json({
      status: "success",
      data: formattedReplies,
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
