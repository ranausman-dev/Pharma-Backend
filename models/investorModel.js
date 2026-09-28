import mongoose from "mongoose";

// Investor schema
const investorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  amount_invested: [
    {
      amount: { type: Number, required: true },
      date: { type: Date, default: Date.now },
      description: { type: String },
    }
  ],
  profit_percentage: { type: Number }, // optional (if fixed % deal)
  mobile_number: { type: String },
  father_name: { type: String },
  address: { type: String },
  shares: { type: Number, default: 0 },
  join_date: { type: Date, required: true },
  status: { type: String, enum: ["active", "inactive"], default: "active" },
  type: {
    type: String,
    enum: ["company", "investor"],
  },

  debit_credit: [
    {
      type: { type: String, enum: ["debit", "credit"], required: true },
      amount: { type: Number, required: true },
      note: String,
      date: { type: Date, default: Date.now },
    }
  ],
  debit: {
    type: Number,
    default: 0,
  },
  credit: {
    type: Number,
    default: 0,
  },
  cnic_number: {
    type: String,
    trim: true
  },
  cnic_front_photo: {
    type: String,
    trim: true
  },
  cnic_back_photo: {
    type: String,
    trim: true
  },
  stam_photo: {
    type: String,
    trim: true
  },
  check_photo: {
    type: String,
    trim: true
  }
}, { timestamps: true });

export default mongoose.model("Investor", investorSchema);
