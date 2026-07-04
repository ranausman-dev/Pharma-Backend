import mongoose from "mongoose";

const supplierLedgerSchema = new mongoose.Schema({
  supplier_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Supplier",
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
  order_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
    default: null
  },
}, {
  timestamps: true, 
});

export const SupplierLedger = mongoose.model("SupplierLedger", supplierLedgerSchema);
