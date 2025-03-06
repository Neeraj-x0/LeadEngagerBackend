import { Router, Response } from "express";
import { Request } from "../types";
import {
  bulkDeleteLeads,
  createLead,
  deleteAll,
  deleteLead,
  getLeadById,
  getLeads,
  updateCategory,
  updateStatus,
} from "../database/leads";
import { catchAsync } from "../utils/errorHandler";
import { parseBody, processImport } from "../utils/functions";

const router = Router();

router.get(
  "/",
  catchAsync(async (req: Request, res: Response) => {
    const { id } = req.user;
    const leads = await getLeads(id);
    res.json({ data: leads });
  })
);

router.get(
  "/:id",
  catchAsync(async (req: Request, res: Response) => {
    const lead = await getLeadById(req.params.id, req.user.id);
    res.json(lead);
  })
);

router.post(
  "/",
  catchAsync(async (req: Request, res: Response) => {
    const body = parseBody(req.body);
    const lead = await createLead(body, req.user.id);
    res.json(lead);
  })
);

router.post(
  "/bulk-import",
  catchAsync(async (req: Request, res: Response) => {
    let file;
    if (req.files) {
      if (Array.isArray(req.files)) {
        file = req.files.find((f) => f.fieldname === "file");
      } else {
        const fileArray = Object.values(req.files).flat();
        file = fileArray.find((f) => f.fieldname === "file");
      }
    }
    if (!file) {
      throw new Error("No file uploaded");
    }
    let fileBuffer = file.buffer;
    let body = parseBody(req.body);
    let category = body?.category || undefined;
    let ext = file.originalname.split(".").pop();
    if (!ext) {
      throw new Error("File type not supported");
    }
    let import_status = await processImport(
      fileBuffer,
      ext,
      category,
      req.user.id
    );
    console.log(import_status);
    res.json(import_status);
  })
);

router.delete(
  "/bulk-delete",
  catchAsync(async (req: Request, res: Response) => {
    const { id } = req.body;
    const result = await bulkDeleteLeads(id, req.user.id);
    res.json(result);
  })
);

router.put(
  "/bulk-update",
  catchAsync(async (req: Request, res: Response) => {
    const { id, category, status } = req.body;
    id.forEach(async (element: string) => {
      if (category) {
        await updateCategory(element, category, req.user.id);
      }
      if (status) {
        await updateStatus(element, status, req.user.id);
      }
    });
    res.json({ message: "Bulk update successful" });
  })
);

router.put(
  "/:id",
  catchAsync(async (req: Request, res: Response) => {
    const { category, status } = req.body;
    if (category) {
      await updateCategory(req.params.id, category, req.user.id);
    } else if (status) {
      await updateStatus(req.params.id, status, req.user.id);
    }
    res.json({ message: "Lead updated successfully" });
  })
);

router.delete(
  "/:id",
  catchAsync(async (req: Request, res: Response) => {
    const lead = await deleteLead(req.params.id, req.user.id);
    res.json(lead);
  })
);

router.delete(
  "/",
  catchAsync(async (req: Request, res: Response) => {
    await deleteAll();
    res.json({ message: "All leads deleted successfully" });
  })
);

export default router;
