import { Router, Response } from "express";
import { Request } from "../types";
import { catchAsync } from "../utils/errorHandler";
import Media from "../models/Media";
import { UserModel } from "../models";

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

router.get("/logo", catchAsync(async (req: Request, res: Response) => {
  const userID = req.user.id;
  const user = await UserModel.findById(userID
  );
  if (user) {
    res.json({ logo: user.companyLogo });
  }
  else {
    res.status(404).json({ message: "User not found" });
  }

}));




export default router;