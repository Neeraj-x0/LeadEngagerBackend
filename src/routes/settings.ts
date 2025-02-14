import { Router, Response } from "express";
import { Request } from "../types";

import { CategoryModel, StatusModel } from "../models/Settings";
import { UserModel } from "../models/UserModel";
import { catchAsync } from "../utils/errorHandler";
import { validate } from "../middlewares/validationMiddleware";
import {
  statusValidationSchema,
  statusUpdateValidationSchema,
} from "../validation";
import { LeadModel } from "../models/LeadModel";

const router = Router();

router.get(
  "/",
  catchAsync(async (req: Request, res: Response) => {
    const categoriesData = await CategoryModel.find({ user: req.user.id });
    const statusData = await StatusModel.find({ user: req.user.id });
    let statuses = statusData.map((status) => status.name);
    let categories = categoriesData.map((category) => category.name);
    let user = await UserModel.findOne({ email: req.user.email });
    if (!user) {
      throw new Error("User not found");
    }
    const { email, name, phoneNumber, companyName, companyLogo } = user;
    res.json({
      categories,
      statuses,
      businessProfile: {
        email,
        name,
        phoneNumber,
        companyName,
        companyLogo,
      },
    });
  })
);

router.get(
  "/categories",
  catchAsync(async (req: Request, res: Response) => {
    const categoriesData = await CategoryModel.find({ user: req.user.id });
    let categories = categoriesData.map((category) => category.name);
    res.json({ categories });
  })
);

router.get(
  "/statuses",
  catchAsync(async (req: Request, res: Response) => {
    const statusData = await StatusModel.find({ user: req.user.id });
    let statuses = statusData.map((status) => status.name);
    res.json({ statuses });
  })
);

router.post(
  "/category",
  validate(statusValidationSchema),
  catchAsync(async (req: Request, res: Response) => {
    const name = req.body.name;
    const user = req.user.id;
    console.log(name, user);
    const category = new CategoryModel({ name, user });
    await category.save();
    res.json(category);
  })
);

router.put(
  "/category",
  validate(statusUpdateValidationSchema),
  catchAsync(async (req: Request, res: Response) => {
    const { name, newName } = req.body;
    console.log(name, newName);
    await LeadModel.updateMany({ category: name }, { category: newName });
    await CategoryModel.updateOne({ name }, { name: newName });
    return res.json({ message: "Category updated successfully" });
  })
);

router.delete(
  "/category",
  validate(statusValidationSchema),
  catchAsync(async (req: Request, res: Response) => {
    const { name } = req.body;
    await LeadModel.updateMany(
      { category: name },
      { category: "Uncategorized" }
    );
    await CategoryModel.deleteOne({ name });
    res.json({ message: "Category deleted successfully" });
  })
);

router.post(
  "/status",
  validate(statusValidationSchema),
  catchAsync(async (req: Request, res: Response) => {
    const { name } = req.body;
    const user = req.user.id;
    const status = new StatusModel({ name, user });
    await status.save();
    res.json(status);
  })
);
router.put(
  "/status",
  validate(statusUpdateValidationSchema),
  catchAsync(async (req: Request, res: Response) => {
    const { name, newName } = req.body;
    await LeadModel.updateMany({ status: name }, { status: newName });
    await StatusModel.updateOne({ name }, { name: newName });
    return res.json({ message: "Status updated successfully" });
  })
);

router.delete(
  "/status",
  validate(statusValidationSchema),
  catchAsync(async (req: Request, res: Response) => {
    const { name } = req.body;
    await LeadModel.updateMany({ status: name }, { status: "Uncategorized" });
    await StatusModel.deleteOne({ name });
    res.json({ message: "Status deleted successfully" });
  })
);

export default router;
