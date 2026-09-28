import mongoose from "mongoose";

const bulkCashRecoverySchema = new mongoose.Schema({
  cash_id: {
    type: String,
<<<<<<< HEAD
=======
    unique: true,
>>>>>>> 54864e09bfb82fba45a6586c3ecb7b9f2ac0e4aa
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
  order_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
    default: null,
  },
}, {
  timestamps: true,
});

export const BulkCashRecovery = mongoose.model("BulkCashRecovery", bulkCashRecoverySchema);
