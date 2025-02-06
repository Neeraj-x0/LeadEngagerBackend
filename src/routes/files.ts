import { Router, Response } from "express";
import { Request } from "../types";
import { catchAsync } from "../utils/errorHandler";

const router = Router();

router.get(
  "/:id",
  catchAsync(async (req: Request, res: Response) => {
    res.json({ message: "File found" });
  })
);
