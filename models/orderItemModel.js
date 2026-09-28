import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    order_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    },
    estimate_product_name: {
      type: String,
      default: ""
    },
    batch: {
      type: String,
      required: true,
    },
    expiry: { type: String, default: null },
    units: {
      type: Number,
      required: true,
    },
    unit_price: {
      type: Number,
      required: true,
    },
    discount: {
      type: Number,
      default: 0,
    },
    profit: { type: Number, default: 0 },
    total: {
      type: Number,
      required: true,
    },
    retail_price: {
      type: Number,
      default: 0,
    },
    trade_price: {
      type: Number,
      default: 0,
    },
    sales_tax: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

export const OrderItemModel = mongoose.model("OrderItem", orderItemSchema);

