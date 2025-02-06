import express, { Request, Response } from "express";
import { validate } from "../middlewares/validationMiddleware";
import { catchAsync } from "../utils/errorHandler";
import { UserModel } from "../models/UserModel";
import bcrypt from "bcryptjs";
import { generateToken } from "../utils/functions";
import { userValidationSchema } from "../validation";

const router = express.Router();

router.post(
  "/user",
  validate(userValidationSchema),
  catchAsync(async (req: Request, res: Response) => {
    const { email, password, phoneNumber, name, companyName, companyLogo } =
      req.body;

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new UserModel({
      email,
      password: hashedPassword,
      phoneNumber,
      name,
      companyLogo,
      companyName,
    });
    await user.save();
    let token = generateToken({
      email: user.email,
      id: user._id,
      name: user.name,
      companyName: user.companyName,
      companyLogo: user.companyLogo,
    });
    res.status(201).json({
      status: "success",
      data: {
        user: {
          email: user.email,
          phoneNumber: user.phoneNumber,
          name: user.name,
          companyName: user.companyName,
          companyLogo: user.companyLogo,
        },
        token,
      },
    });
  })
);

router.delete(
  "/user",
  catchAsync(async (req: Request, res: Response) => {
    await UserModel.deleteMany({});
    res.json({ message: "All users deleted" });
  })
);

export default router;
