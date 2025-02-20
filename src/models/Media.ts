import mongoose from "mongoose";

const mediaSchema = new mongoose.Schema({
    file: {
        type: Buffer,
        required: true,
    },
});

const Media = mongoose.model("Media", mediaSchema);

export default Media;