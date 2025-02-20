import { Router, Response } from "express";
import { Request } from "../types";
import { catchAsync } from "../utils/errorHandler";
import Media from "../models/Media";

const router = Router();

router.get(
  "/:id",
  catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const media = await Media.findById(id);
    if (!media) {
      return res.status(404).json({ message: "Media not found" });
    }
    res.setHeader("Content-Type", "image/png");
    return res.send(media.file);
  })
);


export default router;