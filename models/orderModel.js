import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    invoice_number: { type: String, default: null, },
    purchase_number: { type: String },
    supplier_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      default: null,
    },
    booker_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    subtotal: { type: Number, required: true },
    total: { type: Number, required: true },
    paid_amount: { type: Number, required: true },
    due_amount: { type: Number, default: 0 },
    due_date: { type: Date, default: null },
    estimate_date: { type: String, default: "" },
    estimate_customer_name: { type: String, default: "" },
    net_value: { type: Number, required: true },
    recovered_amount: { type: Number, default: 0 },
    recovered_date: { type: Date, default: null },
    recovered_amount: { type: Number, default: 0 },
    recovered_date: { type: Date, default: null },
    recovered_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    note: { type: String },
    profit: { type: Number, default: 0 },
    type: {
      type: String,
      enum: ["purchase", "sale", "estimated", "purchase_return", "sale_return"],
      required: true,
    },
    status: {
      type: String,
      enum: ["completed", "skipped", "returned", "recovered"],
      default: "completed",
    },
  },
  { timestamps: true }
);

export const OrderModel = mongoose.model("Order", orderSchema);
