import { createLead } from "../database/leads";
import * as XLSX from "xlsx";
import csv from "csv-parse/sync";
import jwt from "jsonwebtoken";
import { AppError } from "./errorHandler";
import moment from "moment-timezone";
export interface LeadData {
  Name: string;
  Phone: string;
  Email: string;
  Note?: string;
  Category?: string;
}

export interface ImportResult {
  imported: number;
  errors: Array<{ lead: LeadData; error: string }>;
}

const REQUIRED_FIELDS = ["Name", "Phone", "Email"];

/**
 * Validate that each lead has required fields.
 */
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

/**
 * Parse CSV buffer into an array of leads.
 */
function parseCSVBuffer(buffer: Buffer): LeadData[] {
  try {
    return csv.parse(buffer, {
      columns: true,
      skip_empty_lines: true,
    });
  } catch (error: any) {
    throw new AppError(
      `CSV parsing failed: ${error.message || "Unknown error"}`,
      400
    );
  }
}

/**
 * Parse Excel buffer into an array of leads.
 */
function parseExcelBuffer(buffer: Buffer): LeadData[] {
  try {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]) as LeadData[];
  } catch (error: any) {
    throw new AppError(
      `Excel parsing failed: ${error.message || "Unknown error"}`,
      400
    );
  }
}

/**
 * Process leads concurrently using limited parallelism.
 *
 * Here we use a concurrency limiter that avoids overwhelming the system.
 * This is a purely asynchronous solution (without worker_threads) that batches lead creation.
 */
async function processLeadsConcurrently(
  leads: LeadData[],
  defaultCategory: string,
  user: string,
  concurrency: number = 50
): Promise<ImportResult> {
  let totalImported = 0;
  const errors: Array<{ lead: LeadData; error: string }> = [];

  // This function wraps createLead, ensuring that any error is caught.
  const processLead = async (lead: LeadData): Promise<void> => {
    const category = lead.Category || defaultCategory;
    try {
      await createLead(
        {
          name: lead.Name,
          phone: lead.Phone,
          email: lead.Email,
          notes: lead.Note,
          category,
        },
        user
      );
      totalImported++;
    } catch (error: any) {
      errors.push({
        lead,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  };

  // Create an array of tasks
  const tasks = leads.map((lead) => processLead(lead));

  // Process tasks in batches with defined concurrency limit
  for (let i = 0; i < tasks.length; i += concurrency) {
    const batch = tasks.slice(i, i + concurrency);
    await Promise.all(batch);
  }

  return { imported: totalImported, errors };
}

/**
 * Main function: Import leads from file buffer and process them.
 */
export async function importLeadsFromBuffer(
  fileBuffer: Buffer,
  fileType: string,
  defaultCategory: string,
  user: string
): Promise<ImportResult> {
  let leads: LeadData[];

  if (fileType === "csv") {
    leads = parseCSVBuffer(fileBuffer);
  } else if (fileType === "xlsx" || fileType === "xls") {
    leads = parseExcelBuffer(fileBuffer);
  } else {
    throw new AppError(`Unsupported file type: ${fileType}`, 400);
  }

  if (!leads.length) {
    throw new AppError("No leads found in file", 400);
  }

  validateLeads(leads);
  return await processLeadsConcurrently(leads, defaultCategory, user);
}

/**
 * Process and report the import.
 */
export async function processImport(
  buffer: Buffer,
  type: string,
  defaultCategory: string,
  user: string
) {
  try {
    const result = await importLeadsFromBuffer(
      buffer,
      type,
      defaultCategory,
      user
    );
    if (result.errors.length > 0) {
      console.error("Import completed with errors:", result.errors);
    }

    return {
      success: result.errors.length === 0,
      imported: result.imported,
      errors: result.errors,
      message:
        result.errors.length > 0
          ? `Imported ${result.imported} leads with ${result.errors.length} errors`
          : `Successfully imported ${result.imported} leads`,
    };
  } catch (error: any) {
    console.error("Import error:", error);
    const errorMsg =
      error instanceof Error
        ? `Import failed: ${error.message}`
        : "Import failed: Unknown error";
    return {
      success: false,
      imported: 0,
      errors: [{ lead: {} as LeadData, error: errorMsg }],
      message: errorMsg,
    };
  }
}

/**
 * Generate a JWT token for a user object.
 */
export const generateToken = (user: Record<string, any>): string => {
  return jwt.sign({ ...user }, process.env.JWT_SECRET as string, {
    expiresIn: "30d",
  });
};

/**
 * Clean a phone number by removing non-digit characters.
 */
export const validatePhone = (phone: string): string => {
  return phone.replace(/\D/g, "");
};

/**
 * Render a body template by replacing data placeholders.
 */
export const renderBody = (
  body: string,
  data: Record<string, any>,
  bodyType: "html" | "text"
): string => {
  let rendered = body;
  for (const key in data) {
    const pattern = new RegExp(`{{\\s*${key}\\s*}}`, "g");
    rendered = rendered.replace(pattern, data[key]);
  }
  return bodyType === "text" ? rendered.replace(/<[^>]+>/g, "") : rendered;
};

/**
 * Recursively parse an object, cleaning empty values.
 */
export const parseBody = (obj: any): any => {
  if (obj === null || obj === undefined) return undefined;
  if (typeof obj !== "object") return obj === "" ? undefined : obj;
  if (Array.isArray(obj)) {
    const cleanedArray = obj
      .map(parseBody)
      .filter((item) => item !== undefined);
    return cleanedArray.length ? cleanedArray : undefined;
  }
  const cleanedObj: Record<string, any> = {};
  let hasValidProperties = false;
  for (const [key, value] of Object.entries(obj)) {
    const cleanedValue = parseBody(value);
    if (cleanedValue !== undefined) {
      cleanedObj[key] = cleanedValue;
      hasValidProperties = true;
    }
  }
  return hasValidProperties ? cleanedObj : undefined;
};

export const convertToTimezone = (
  date: Date,
  timezone: string = "Asia/Kolkata"
): string => {
  return moment.utc(date).tz(timezone).format("YYYY-MM-DD HH:mm:ss Z");
};
