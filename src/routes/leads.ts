import { Router, Request, Response } from "express";
import {
  createLead,
  deleteLead,
  getLeadById,
  getLeads,
  updateCategory,
  updateLead,
  updateStatus,
} from "../database/leads";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const leads = await getLeads();
    res.json(leads);
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const lead = await getLeadById(req.params.id);
    res.json(lead);
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const lead = await createLead(req.body);
    res.json(lead);
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

router.put("/:id", async (req: Request, res: Response) => {
  try {
    const lead = await updateLead(req.params.id, req.body);
    res.json(lead);
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

router.put("/:id/category", async (req: Request, res: Response) => {
  try {
    const lead = await updateCategory(req.params.id, req.body.category);
    res.json(lead);
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

router.put("/:id/status", async (req: Request, res: Response) => {
  try {
    const lead = await updateStatus(req.params.id, req.body.status);
    res.json(lead);
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const lead = await deleteLead(req.params.id);
    res.json(lead);
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

export default router;
