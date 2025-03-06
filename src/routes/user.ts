import express, { Response } from "express";
import { Request } from "../types";
import { validate } from "../middlewares/validationMiddleware";
import { catchAsync } from "../utils/errorHandler";
import { UserModel } from "../models/UserModel";
import bcrypt from "bcryptjs";
import { generateToken } from "../utils/functions";
import { userValidationSchema } from "../validation";
import { createBrochure ,getBrochure} from "../database/brochure";

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


router.post(
  "/user/brochure",
  catchAsync(async (req: Request, res: Response) => {
    const user = req.user.id
    let brochure;
    if (req.files) {
      if (Array.isArray(req.files)) {
        brochure = req.files.find((f) => f.fieldname === "file");
      } else {
        const fileArray = Object.values(req.files).flat();
        brochure = fileArray.find((f) => f.fieldname === "file");
      }
    }
    if (!brochure) {
      throw new Error("No file uploaded");
    }
    await createBrochure(user, brochure)
    res.json({ message: "Brochure created successfully" })
  })
);


router.get(
  "/user/brochure",
  catchAsync(async (req: Request, res: Response) => {
    const user = req.user.id
    const {brochure,mimetype} = await getBrochure(user)
    res.setHeader('Content-Type', mimetype);
    res.send(brochure)

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
