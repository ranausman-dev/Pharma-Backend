import mongoose from "mongoose";

const bulkCashRecoverySchema = new mongoose.Schema({
  cash_id: {
    type: String,
    unique: true,
    required: true,
  },
  customer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Supplier",
    required: true,
  },
  booker_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  note: {
    type: String,
    default: "",
  },
  status: {
    type: String,
    enum: ["active", "reversed"],
    default: "active",
  },
}, {
  timestamps: true,
});

export const BulkCashRecovery = mongoose.model("BulkCashRecovery", bulkCashRecoverySchema);
