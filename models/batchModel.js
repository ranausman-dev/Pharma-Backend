import mongoose from "mongoose";

const batchSchema = new mongoose.Schema({
  product_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  batch_number: {
    type: String,
    required: true
  },
  purchase_price: {
    type: Number,
    required: true
  },
  stock: {
    type: Number,
    default: 0
  },
  unit_cost: {
    type: Number,
    default: 0
  },
  discount_per_unit: {
    type: Number,
    default: 0
  },
  expiry_date: {
    type: String,
    required: true
  },
  retail_price: {
    type: Number,
    default: 0
  },
  trade_price: {
    type: Number,
    default: 0
  },
  sales_tax: {
    type: Number,
    default: 0
  },
}, { timestamps: true });

export const BatchModel = mongoose.model("Batch", batchSchema);
