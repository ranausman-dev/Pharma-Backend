import mongoose from "mongoose";

const freeSaleDescSchema = new mongoose.Schema(
    {
        desc: {
            type: String,
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model("FreeSaleDesc", freeSaleDescSchema);
