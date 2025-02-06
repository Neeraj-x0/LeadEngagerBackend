import { Router, Request, Response } from "express";
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
import {processImport} from "../utils/functions";

const router = Router();

router.get(
  "/",
  catchAsync(async (req: Request, res: Response) => {
    const leads = await getLeads();
    res.json({ data: leads });
  })
);

router.get(
  "/:id",
  catchAsync(async (req: Request, res: Response) => {
    const lead = await getLeadById(req.params.id);
    res.json(lead);
  })
);

router.post(
  "/",
  catchAsync(async (req: Request, res: Response) => {
    const lead = await createLead(req.body);
    res.json(lead);
  })
);

router.post(
  "/bulk-import",
  catchAsync(async (req: Request, res: Response) => {
    const fileBuffer = req.file?.buffer;
    if (!fileBuffer) {
      throw new Error("No file uploaded");
    }
    let category = req.body.category;
    let ext = req.file?.originalname.split(".").pop();
    if (!ext) {
      throw new Error("File type not supported");
    }
    let import_status = await processImport(
      fileBuffer as Buffer,
      ext,
      category
    );
    console.log(import_status);
    res.json(import_status);
  })
);

router.delete(
  "/bulk-delete",
  catchAsync(async (req: Request, res: Response) => {
    const { id } = req.body;
    const result = await bulkDeleteLeads(id);
    res.json(result);
  })
);

router.put(
  "/bulk-update",
  catchAsync(async (req: Request, res: Response) => {
    const { id, category, status } = req.body;
    id.forEach(async (element: string) => {
      if (category) {
        await updateCategory(element, category);
      }
      if (status) {
        await updateStatus(element, status);
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
      const lead = await updateCategory(req.params.id, category);
    } else if (status) {
      const lead = await updateStatus(req.params.id, status);
    }
    res.json({ message: "Lead updated successfully" });
  })
);

router.delete(
  "/:id",
  catchAsync(async (req: Request, res: Response) => {
    const lead = await deleteLead(req.params.id);
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
