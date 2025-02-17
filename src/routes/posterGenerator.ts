import { Router, Response } from "express";
import { Request } from "../types/types";
import { catchAsync } from "../utils/errorHandler";
import { PosterGenerator } from "../utils/poster";
import axios from "axios";
import { AppError } from "../utils/errorHandler";

const router = Router();


router.post("/", catchAsync(async (req: Request, res: Response) => {
    const files = req.files as { icon: Express.Multer.File[], background?: Express.Multer.File[] };
    const iconBuffer = files.icon[0].buffer;
    const backgroundBuffer = files.background ? files.background[0].buffer : undefined;
    if (!req.files || !files.icon) {
        throw new AppError("Please upload an image", 400);
    }
    const { title, note } = req.body;

    const { companyName, name, companyLogo } = req.user;
    const logoBuffer = await axios.get(companyLogo, { responseType: 'arraybuffer' }).then(response => Buffer.from(response.data, 'binary'));
    const posterGenerator = new PosterGenerator();
    const posterBuffer = await posterGenerator.generate({ logoBuffer, companyName, name, title, note, iconBuffer, backgroundBuffer });
    res.setHeader('Content-Type', 'image/png');
    res.send(posterBuffer);
}
));

export default router;