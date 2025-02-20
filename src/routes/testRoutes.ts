import { Router, Request, Response } from "express";
import { catchAsync } from "../utils/errorHandler";

import Media from "../models/Media";


const router = Router();


router.post(
    "/media", catchAsync(async (req: Request, res: Response) => {
        if (!req.files || !("file" in req.files)) {
            throw new Error("No file uploaded");
        }
        const file = (req.files as { [key: string]: Express.Multer.File[] })["file"][0].buffer;
        console.log(file);

        const media = new Media({
            file
        });
        await media.save();
        res.status(201).json({
            status: "success",
            data: {
                media: {
                    file: media
                }
            }
        });
    }
    ));


export default router;