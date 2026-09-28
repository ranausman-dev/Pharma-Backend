import mongoose from "mongoose";

const packSizeSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model("PackSize", packSizeSchema);
