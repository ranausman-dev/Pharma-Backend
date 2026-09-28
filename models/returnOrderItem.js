import mongoose from "mongoose";

const returnOrderItemSchema = new mongoose.Schema(
    {
        order_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
            required: true,
        },
        product_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true,
        },
        batch: {
            type: String,
            required: true,
        },
        expiry: {
            type: Date,
            required: true,
        },
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
        total: {
            type: Number,
            required: true,
        },
        type: {
            type: String,
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

export const ReturnOrderItemModel = mongoose.model("ReturnOrderItem", returnOrderItemSchema);

