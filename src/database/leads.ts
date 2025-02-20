import mongoose from "mongoose";
import { LeadModel } from "../models/LeadModel";
import { CategoryModel } from "../models/Settings";
import { AppError } from "../utils/errorHandler";
import crypto from "crypto";
import { EngagementModel } from "../models";

async function createLead(lead: any, user: string) {
  try {

    // Generate a unique 6-digit ID based on user data
    let id = generateUniqueId(lead);

    // Check if the generated ID already exists in the database
    let leadExists = await LeadModel.findOne({ id: id, user });

    // If the lead with this ID already exists, regenerate the ID
    while (leadExists) {
      id = generateUniqueId(lead); // Generate a new ID
      leadExists = await LeadModel.findOne({ id: id, user }); // Check again
    }

    // Assign the unique ID to the lead object
    lead.id = id;

    // Create a new lead with the unique ID
    const newLead = new LeadModel({ ...lead, user });
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
async function getLeads(id: string) {
  try {
    return await LeadModel.find({ user: id });
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

async function getLeadById(id: string, user: string) {
  try {
    const lead = await LeadModel.findOne({ id, user });
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

async function updateCategory(id: string, category: string, user: string) {
  try {
    // const categoryExists = await CategoryModel.exists({ name: category });
    // if (!categoryExists) {
    //   throw new AppError("Category not found", 404);
    // }

    await LeadModel.findOneAndUpdate({ id, user }, { category });
    return { message: "Category updated successfully" };
  } catch (error) {
    if (error instanceof Error) {
      throw new AppError(error.message, 400);
    } else {
      throw new AppError("An unknown error occurred", 400);
    }
  }
}

async function updateStatus(id: string, status: string, user: string) {
  try {
    await LeadModel.findOneAndUpdate({ id, user }, { status });
    return { message: "Status updated successfully" };
  } catch (error) {
    if (error instanceof Error) {
      throw new AppError(error.message, 400);
    } else {
      throw new AppError("An unknown error occurred", 400);
    }
  }
}

async function deleteLead(id: string, user: string) {
  try {
    await LeadModel.findOneAndDelete({ id, user });
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

async function getLeadsByCategory(category: string, user: string) {
  try {
    return await LeadModel.find({ category, user });
  } catch (error) {
    if (error instanceof Error) {
      throw new AppError(error.message, 400);
    } else {
      throw new AppError("An unknown error occurred", 400);
    }
  }
}

async function getLeadsByCategoryStatus(
  user: string,
  category?: string,
  status?: string
) {
  try {
    interface QueryType {
      user: string;
      category?: string;
      status?: string;
    }
    let query: QueryType = { user };
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

async function bulkDeleteLeads(idArray: string[], user: string) {
  try {
    await LeadModel.deleteMany({ id: { $in: idArray }, user });
    return { message: "Leads deleted successfully" };
  } catch (error) {
    if (error instanceof Error) {
      throw new AppError(error.message, 400);
    } else {
      throw new AppError("An unknown error occurred", 400);
    }
  }
}

async function getLeadByEngagementID(id: mongoose.Types.ObjectId) {
  try {
    const engagement = await EngagementModel.findById(id)

    return await LeadModel.find({ category: engagement?.category, user: engagement?.user })
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
  getLeadByEngagementID,
  getLeadById,
  updateCategory,
  getLeadsByCategory,
  getLeadsByCategoryStatus,
  deleteAll,
  bulkDeleteLeads,
  updateStatus,
  deleteLead,
};
