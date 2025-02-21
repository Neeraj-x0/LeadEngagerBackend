import { Router } from "express";
import { Response } from "express";
import ChatBotPrompt from "../models/ChatBotPrompt";
import { Request } from "../types";
import { catchAsync } from "../utils/errorHandler";

const router = Router();

router.get("/prompt", catchAsync(async (req: Request, res: Response) => {
    const user = req.user.id;
    const prompts = await ChatBotPrompt.findOne({ user });
    res.json(prompts?.prompt);
}));

router.post("/prompt", catchAsync(async (req: Request, res: Response) => {
    const user = req.user.id;
    const { prompt } = req.body;
    await ChatBotPrompt.findOneAndUpdate({
        user
    }, {
        prompt
    }, { upsert: true });
    res.json({ message: "Prompt updated" });
}));


export default router;