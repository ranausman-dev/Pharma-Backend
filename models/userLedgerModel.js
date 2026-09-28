import mongoose from "mongoose";

const userLedgerSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  description: {
    type: String,
  },
  debit: {
    type: Number,
    default: 0,
  },
  credit: {
    type: Number,
    default: 0,
  },
  incentive_amount: {
    type: Number,
    default: 0,
  },
  order_id: {
    type: String,
    default: null
  },
  total_balance: {
    type: String, // Stored as "3500 DB" or "0 CR"
    default: "0 CR",
  },
}, {
  timestamps: true, 
});


export const UserLedger = mongoose.model("UserLedger", userLedgerSchema);