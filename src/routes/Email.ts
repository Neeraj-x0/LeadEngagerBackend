import { Router, Response } from "express";
import { Request } from "../types";
import { catchAsync } from "../utils/errorHandler";
import MailService from "../utils/mail";
import { fetchHtml } from "../database/template";
import { validate } from "../middlewares/validationMiddleware";
import { emailValidationSchema } from "../validation/email";

const router = Router();

router.post(
  "/",
  validate(emailValidationSchema),
  catchAsync(async (req: Request, res: Response) => {
    const {
      subject,
      data,
      bodyType = "html",
      customHTML,
      templateId,
      type = "mailgun",
    } = req.body;

    const to = req.lead.email;

    // Fetch HTML template if not using customHTML
    let body = customHTML || (templateId ? await fetchHtml(templateId) : null);
    if (!body) {
      return res
        .status(400)
        .json({ message: "No email body provided or found" });
    }

    // Adjust body based on the bodyType (html/text)
    if (bodyType === "text") {
      body = body.replace(/<[^>]+>/g, ""); // Remove HTML tags for plain text
    }

    // Create MailService instance and send email
    const mailService = new MailService({
      email: req.user.email,
      name: req.user.name,
    });

    const sendResponse = await mailService.sendMail(
      to,
      subject,
      body,
      data,
      type,
      bodyType
    );
    res.status(200).json({
      success: true,
      message: "Email sent successfully",
      emailId: sendResponse.id,
      response: sendResponse,
    });
  })
);

export default router;
