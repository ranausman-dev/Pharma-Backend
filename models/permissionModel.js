// models/Permission.js
import mongoose from "mongoose";

const permissionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    //   unique: true
    },
    permissions: [
      {
        type: String, 
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model("Permission", permissionSchema);
