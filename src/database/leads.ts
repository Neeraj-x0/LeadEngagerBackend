import { LeadModel } from "../models/LeadModel";
import { CategoryModel } from "../models/CategoryModel";
import { AppError } from "../utils/errorHandler";

async function createLead(lead: any) {
  try {
    const newLead = new LeadModel(lead);
    await newLead.save();
    return newLead;
  } catch (error) {
    if (error instanceof Error) {
      throw new AppError(error.message, 400);
    } else {
      throw new AppError("An unknown error occurred", 400);
    }
  }
}

async function getLeads() {
  try {
    return await LeadModel.find();
  } catch (error) {
    if (error instanceof Error) {
      throw new AppError(error.message, 400);
    } else {
      throw new AppError("An unknown error occurred", 400);
    }
  }
}

async function getLeadById(id: string) {
  try {
    return await LeadModel.findOne({ id });
  } catch (error) {
    if (error instanceof Error) {
      throw new AppError(error.message, 400);
    } else {
      throw new AppError("An unknown error occurred", 400);
    }
  }
}

async function updateCategory(id: string, category: string) {
  try {
    const categoryExists = await CategoryModel.exists({ name: category });
    if (!categoryExists) {
      throw new AppError("Category not found", 404);
    }
    await LeadModel.findOneAndUpdate({ id }, { category });
    return { message: "Category updated successfully" };
  } catch (error) {
    if (error instanceof Error) {
      throw new AppError(error.message, 400);
    } else {
      throw new AppError("An unknown error occurred", 400);
    }
  }
}

async function updateStatus(id: string, status: string) {
  try {
    await LeadModel.findOneAndUpdate({ id }, { status });
    return { message: "Status updated successfully" };
  } catch (error) {
    if (error instanceof Error) {
      throw new AppError(error.message, 400);
    } else {
      throw new AppError("An unknown error occurred", 400);
    }
  }
}

async function deleteLead(id: string) {
  try {
    await LeadModel.findOneAndDelete({ id });
    return { message: "Lead deleted successfully" };
    }
    catch (error) {
        if (error instanceof Error) {
            throw new AppError(error.message, 400);
        } else {
            throw new AppError("An unknown error occurred", 400);
        }
        }
}

async function updateLead(id: string, lead: any) {
    try {
        await LeadModel.findOneAndUpdate({ id }, lead);
        return { message: "Lead updated successfully" };
    }
    catch (error) {
        if (error instanceof Error) {
            throw new AppError(error.message, 400);
        } else {
            throw new AppError("An unknown error occurred", 400);
        }
    }
}


export { createLead, getLeads, getLeadById, updateCategory, updateStatus, deleteLead, updateLead };