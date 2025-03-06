import express, { Response } from "express";
import { AppError, catchAsync } from "../utils/errorHandler";
import { validate } from "../middlewares/validationMiddleware";
import { WhatsAppvalidators } from "../validation";
import {
  MediaRequest,
  TextMessageRequest,
  WhatsAppResponse,
} from "../types/WhatsApp";
import { messageHandler } from "../services/WhatsApp";
import { validatePhone } from "../utils/functions";

const router = express.Router();

// Helper function to validate and format phone number

// Route for sending text messages
router.post(
  "/text",
  validate(WhatsAppvalidators.textMessage),
  catchAsync(
    async (req: TextMessageRequest, res: Response<WhatsAppResponse>) => {
     
      const { message } = req.body;
      const { phone } = req.lead;

      const jid = `${validatePhone(phone)}@s.whatsapp.net`;
      await messageHandler.sendMessage(jid, { text: message }, {}, { id: req.user.id });
      res.json({ success: true, message: "Text message sent successfully" });
    }
  )
);

// Route for sending media (images, videos, audio)
router.post(
  "/:mediaType(image|video|audio|document)",
  validate(WhatsAppvalidators.media),
  catchAsync(async (req: MediaRequest, res: Response<WhatsAppResponse>) => {
    const { caption, mediaType, fileName, type } = req.body;
    const { phone } = req.lead;
    const jid = `${validatePhone(phone)}@s.whatsapp.net`;

    const content = req.file?.buffer;
    if (!content) {
      throw new AppError(`No ${mediaType} content provided`, 400);
    }

    await messageHandler.sendMessage(
      jid,
      { [mediaType]: content },
      { caption: caption || "", fileName: fileName || "file", mimetype: type },
      { id: req.user.id }
    );

    res.json({ success: true, message: `${mediaType} sent successfully` });
  })
);

// Route for sending stickers
router.post(
  "/sticker",
  validate(WhatsAppvalidators.sticker),
  catchAsync(async (req: MediaRequest, res: Response<WhatsAppResponse>) => {
    const { phone } = req.lead;
    const jid = `${validatePhone(phone)}@s.whatsapp.net`;

    const content = req.file?.buffer;
    if (!content) {
      throw new AppError("No sticker content provided", 400);
    }
    await messageHandler.sendMessage(jid, content, {});
    res.json({ success: true, message: "Sticker sent successfully" });
  })
);

export default router;
