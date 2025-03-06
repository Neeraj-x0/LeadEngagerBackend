import BrochureModel from "../models/Brochure";

async function createBrochure(user: string, file: Express.Multer.File) {
    const existingBrochure = await BrochureModel.findOne({ user });
    if (existingBrochure) {
        await BrochureModel.findByIdAndDelete(existingBrochure._id);
    }
    const brochure = await BrochureModel.create({
        user,
        file: file.buffer,
        fileName: file.originalname,
        fileType: file.mimetype,
    });
    return brochure;
}

async function getBrochure(user: string) {
    const brochure = await BrochureModel.findOne({ user });
    if (!brochure) {
        throw new Error("Brochure not found");
    }   
    return { brochure: brochure?.file, mimetype: brochure?.fileType ,fileName: brochure?.fileName}
}

export { createBrochure, getBrochure };
