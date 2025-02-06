import { LeadModel } from "../models/LeadModel";
import { CategoryModel } from "../models/Settings";
import { AppError } from "../utils/errorHandler";
import crypto from "crypto";

async function createLead(lead: any) {
  try {
    // Generate a unique 6-digit ID based on user data
    let id = generateUniqueId(lead);

    // Check if the generated ID already exists in the database
    let leadExists = await LeadModel.findOne({ id: id });

    // If the lead with this ID already exists, regenerate the ID
    while (leadExists) {
      id = generateUniqueId(lead); // Generate a new ID
      leadExists = await LeadModel.findOne({ id: id }); // Check again
    }

    // Assign the unique ID to the lead object
    lead.id = id;

    // Create a new lead with the unique ID
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

// Function to generate a 6-digit unique ID based on user data
function generateUniqueId(lead: any): string {
  const rawData = `${lead.name}${lead.email}${lead.phone}`;
  const hash = crypto.createHash("sha256").update(rawData).digest("hex");
  const id = (parseInt(hash.slice(0, 6), 16) % 900000) + 100000; // Ensure ID is between 100000 and 999999
  return id.toString();
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

async function deleteAll() {
  try {
    await LeadModel.deleteMany({});
    return { message: "All leads deleted successfully" };
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
    const lead = await LeadModel.findOne({ id });
    if (lead) {
      return lead;
    } else {
      throw new AppError("Lead not found", 404);
    }
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
    // const categoryExists = await CategoryModel.exists({ name: category });
    // if (!categoryExists) {
    //   throw new AppError("Category not found", 404);
    // }

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
  } catch (error) {
    if (error instanceof Error) {
      throw new AppError(error.message, 400);
    } else {
      throw new AppError("An unknown error occurred", 400);
    }
  }
}

interface updateLeadBody {
  name: string;
  phone: string;
  email: string;
  notes: string;
  category: string;
  status: string;
}

async function getLeadsByCategory(category: string) {
  try {
    return await LeadModel.find({ category });
  } catch (error) {
    if (error instanceof Error) {
      throw new AppError(error.message, 400);
    } else {
      throw new AppError("An unknown error occurred", 400);
    }
  }
}

async function getLeadsByCategoryStatus(category?: string, status?: string) {
  try {
    let query = {};
    if (category) query = { ...query, category };
    if (status) query = { ...query, status };
    return await LeadModel.find(query);
  } catch (error) {
    if (error instanceof Error) {
      throw new AppError(error.message, 400);
    } else {
      throw new AppError("An unknown error occurred", 400);
    }
  }
}

async function bulkDeleteLeads(idArray: string[]) {
  try {
    await LeadModel.deleteMany({ id: { $in: idArray } });
    return { message: "Leads deleted successfully" };
  } catch (error) {
    if (error instanceof Error) {
      throw new AppError(error.message, 400);
    } else {
      throw new AppError("An unknown error occurred", 400);
    }
  }
}

export {
  createLead,
  getLeads,
  getLeadById,
  updateCategory,
  getLeadsByCategory,
  getLeadsByCategoryStatus,
  deleteAll,
  bulkDeleteLeads,
  updateStatus,
  deleteLead,
};
