import express, { Request, Response } from "express";
import { validate } from "../middlewares/validationMiddleware";
//import { tokenValidationSchema } from "../validation/userValidation";
import { catchAsync } from "../utils/errorHandler";

const router = express.Router();

router.post(
  "/users",
  catchAsync(async (req: Request, res: Response) => {
    // User creation logic here
    res.status(201).json({
      status: "success",
      data: {}, // Add user data
    });
  })
);

export default router;
