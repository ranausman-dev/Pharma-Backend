import mongoose from "mongoose";

const genericSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    short_name: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Generic", genericSchema);
