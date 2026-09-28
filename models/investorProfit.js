import mongoose from "mongoose";

const investorProfitSchema = new mongoose.Schema({
    order_id: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
    investor_id: { type: mongoose.Schema.Types.ObjectId, ref: "Investor", required: true },
    month: { type: String, required: true }, // e.g., "2025-09"
    sales: { type: Number, default: 0 },
    gross_profit: { type: Number, default: 0 },
    expense: { type: Number, default: 0 },
    charity: { type: Number, default: 0 },
    net_profit: { type: Number, default: 0 },
    investor_share: { type: Number, default: 0 },
    owner_share: { type: Number, default: 0 },
    investor_amount: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    profit_percentage: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.model("InvestorProfit", investorProfitSchema);
