import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    company_id: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    generic_id: { type: mongoose.Schema.Types.ObjectId, ref: "Generic", required: true },
    name: { type: String, required: true },
    pack_size_id: { type: mongoose.Schema.Types.ObjectId, ref: "PackSize", required: true },
    carton_size: { type: String, default: "12x10" },
    quantity_alert: { type: Number, default: 0 },
    barcode_symbology: { type: String },
    item_code: { type: String },
    product_type: { type: mongoose.Schema.Types.ObjectId, ref: "ProductType", required: true },
    retail_price: { type: Number, required: true },
    trade_price: { type: Number, default: 0 },
    trade_price_percentage: { type: Number, default: 0 },
    wholesale_price: { type: Number, default: 0 },
    wholesale_price_percentage: { type: Number, default: 0 },
    federal_tax: { type: Number, default: 0 },
    federal_tax_percentage: { type: Number, default: 0 },
    gst: { type: Number, default: 0 },
    gst_percentage: { type: Number, default: 0 },
    sales_tax: { type: Number, default: 0 },
    sales_tax_percentage: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export const ProductModel = mongoose.model("Product", productSchema);
