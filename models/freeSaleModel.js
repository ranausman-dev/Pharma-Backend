import mongoose from "mongoose";

const freeSaleItemSchema = new mongoose.Schema({
    product_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        default: null,
    },
    batch: {
        type: String,
        default: null,
    },
    expiry: {
        type: Date,
        default: null,
    },
    quantity: {
        type: Number,
        default: 0,
    },
    sub_total: {
        type: Number,
        default: 0,
    },
});

const freeSaleSchema = new mongoose.Schema(
    {
        invoice_number: { type: String, required: true },
        desc_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FreeSaleDesc',
            default: null,
        },
        sale_person: {
            type: String,
            required: true,
        },
        sale_date: {
            type: String,
            default: null,
        },
        items: {
            type: [freeSaleItemSchema],
            default: [],
        },
        // Root fields kept for backward compatibility with old flat entries
        product_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            default: null,
        },
        batch: {
            type: String,
            default: null,
        },
        expiry: {
            type: Date,
            default: null,
        },
        quantity: {
            type: Number,
            default: 0,
        },
        sub_total: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model("freeSale", freeSaleSchema);