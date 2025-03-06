import mongoose from "mongoose";
import { UserModel } from "./UserModel";

const brochureSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        validate: {
            validator: async function (v: mongoose.Types.ObjectId) {
                const user = await UserModel.findById(v);
                return user !== null;
            },
            message: "User not found",
        },
        unique: true,
    },
    file: {
        type: Buffer,
        required: true,
    },
    fileName: {
        type: String,
        required: true,
    },
    fileType: {
        type: String,
        required: true,
    },
});


const BrochureModel = mongoose.model("Brochure", brochureSchema);

export default BrochureModel;
