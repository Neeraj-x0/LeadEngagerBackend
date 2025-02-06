import { createLead } from "../database/leads";
import * as XLSX from "xlsx";
import csv from "csv-parse/sync";
import { AppError } from "./errorHandler";
import jwt from "jsonwebtoken";

interface LeadData {
  Name: string;
  Phone: string;
  Email: string;
  Note?: string;
  Category?: string;
}

interface WorkerResult {
  imported: number;
  errors: Array<{
    lead: LeadData;
    error: string;
  }>;
}

const REQUIRED_FIELDS = ["Name", "Phone", "Email"];

function validateLeads(leads: LeadData[]): void {
  const errors: string[] = [];

  leads.forEach((lead, index) => {
    REQUIRED_FIELDS.forEach((field) => {
      if (!lead[field as keyof LeadData]) {
        errors.push(
          `Missing required field "${field}" in record at index ${index}: ${JSON.stringify(
            lead
          )}`
        );
      }
    });
  });

  if (errors.length > 0) {
    throw new AppError(`Validation Errors:\n${errors.join("\n")}`, 400);
  }
}

export async function importLeadsFromBuffer(
  fileBuffer: Buffer,
  fileType: string,
  category: string
): Promise<{
  totalImported: number;
  errors: Array<{ lead: LeadData; error: string }>;
}> {
  try {
    let leads: LeadData[];

    if (fileType === "csv") {
      leads = parseCSVBuffer(fileBuffer);
    } else if (fileType === "xlsx" || fileType === "xls") {
      leads = parseExcelBuffer(fileBuffer);
    } else {
      throw new AppError(`Unsupported file type: ${fileType}`, 400);
    }

    if (!leads?.length) {
      throw new AppError("No leads found in file", 400);
    }

    validateLeads(leads);
    return await processLeadsInParallel(leads, category);
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    if (error instanceof Error) {
      throw new AppError(`Import failed: ${error.message}`, 400);
    } else {
      throw new AppError("Import failed: Unknown error", 400);
    }
  }
}

function parseCSVBuffer(buffer: Buffer): LeadData[] {
  try {
    return csv.parse(buffer, {
      columns: true,
      skip_empty_lines: true,
    });
  } catch (error) {
    if (error instanceof Error) {
      throw new AppError(`CSV parsing failed: ${error.message}`, 400);
    } else {
      throw new AppError("CSV parsing failed: Unknown error", 400);
    }
  }
}

function parseExcelBuffer(buffer: Buffer): LeadData[] {
  try {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]) as LeadData[];
  } catch (error) {
    if (error instanceof Error) {
      throw new AppError(`Excel parsing failed: ${error.message}`, 400);
    } else {
      throw new AppError("Excel parsing failed: Unknown error", 400);
    }
  }
}

// Process all leads in parallel using Promise.allSettled 
async function processLeadsInParallel(
  leads: LeadData[],
  category: string
): Promise<{
  totalImported: number;
  errors: { lead: LeadData; error: string }[];
}> {
  const promises = leads.map(async (lead) => {
    let cat;
    if (lead.Category) {
      cat = lead.Category;
    } else {
      cat = category;
    }
    console.log(cat);
    try {
      await createLead({
        name: lead.Name,
        phone: lead.Phone,
        email: lead.Email,
        notes: lead.Note,
        category: cat,
      });
      return { success: true, lead };
    } catch (error) {
      return {
        success: false,
        lead,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  });

  // Wait for all promises to settle
  const results = await Promise.allSettled(promises);

  let totalImported = 0;
  const allErrors: { lead: LeadData; error: string }[] = [];

  results.forEach((result) => {
    if (result.status === "fulfilled") {
      if (result.value.success) {
        totalImported++;
      } else {
        allErrors.push({
          lead: result.value.lead,
          error: result.value.error ?? "Unknown error",
        });
      }
    } else {
      // In case the promise was rejected (should not happen with our catch block above)
      allErrors.push({ lead: {} as LeadData, error: result.reason });
    }
  });

  return { totalImported, errors: allErrors };
}

export async function processImport(
  buffer: Buffer,
  type: string,
  category: string
) {
  try {
    const result = await importLeadsFromBuffer(buffer, type, category);

    if (result.errors.length > 0) {
      // Log errors but continue if some leads were successfully imported
      console.error("Import completed with errors:", result.errors);
    }

    return {
      success: true,
      imported: result.totalImported,
      errors: result.errors,
      message:
        result.errors.length > 0
          ? `Imported ${result.totalImported} leads with ${result.errors.length} errors`
          : `Successfully imported ${result.totalImported} leads`,
    };
  } catch (error) {
    console.error("Import error:", error);
    throw error instanceof AppError
      ? error
      : new AppError("Import failed: " + (error as Error).message, 400);
  }
}


export const generateToken = (user: object): string => {
  return jwt.sign({ ...user }, process.env.JWT_SECRET as string, {
    expiresIn: "30d", // 30 days
  });
};

export const validatePhone = (phone: string): string => {
  const cleanPhone = phone.replace(/\D/g, "");
  return cleanPhone;
};

export const renderBody = (
  body: string,
  data: Record<string, any>,
  bodyType: "html" | "text"
): string => {
  let rendered = body;
  for (const key in data) {
    const pattern = new RegExp(`{{\s*${key}\s*}}`, "g");
    rendered = rendered.replace(pattern, data[key]);
  }
  return bodyType === "text" ? rendered.replace(/<[^>]+>/g, "") : rendered;
}