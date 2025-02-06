import { TemplateModel } from "../models/templateModel";
import { AppError } from "../utils/errorHandler";


async function fetchHtml(id: string) {
  try {
    const template = await TemplateModel.findById(id);
    return template?.content;
  } catch (error) {
    throw new AppError("Template not found", 404);
  }
}


export { fetchHtml };