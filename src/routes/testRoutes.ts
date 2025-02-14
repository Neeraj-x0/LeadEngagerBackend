import { Router, Request, Response } from "express";
import { catchAsync } from "../utils/errorHandler";
import MailService from "../utils/mail";


const router = Router();

interface CustomRequest extends Request {
    user: {
        id: string;
        email: string;
        name: string;
    };
}

router.post("/mailgun", catchAsync(async (req: CustomRequest, res: Response) => {
    const user = req.user;
    const { email, subject, body, data, type, bodyType } = req.body;
    if (!req.file) {
        throw new Error("No file attached");
    }
    const mailService = new MailService(user);
    const result = await mailService.sendMail([email], subject, body, data, type, bodyType, req.file);
    return res.status(200).json({
        status: "success",
        data: result,
    });


})
);



export default router;