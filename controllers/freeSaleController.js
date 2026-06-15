import mongoose from "mongoose";
import FreeSale from "../models/freeSaleModel.js";
import { BatchModel as Batch } from "../models/batchModel.js";
import { successResponse, sendError } from "../utils/response.js";
import { ProductModel as Product } from "../models/productModel.js";

const createFreeSale = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        await session.startTransaction();

        const { invoice_number, product_id, desc_id, sale_person, sale_date, batch, expiry, quantity, sub_total } = req.body;

        // Validate required fields
        if (!product_id || !quantity) {
            await session.abortTransaction();
            return sendError(res, "Product ID and quantity are required", 400);
        }

        // Generate invoice number if not provided
        let finalInvoiceNumber = invoice_number;
        if (!finalInvoiceNumber) {
            // Get the last free sale to generate incremental number
            const lastFreeSale = await FreeSale.findOne().sort({ createdAt: -1 }).session(session);

            // Start from FREE-0001 if no sales exist yet
            const lastNumber = lastFreeSale?.invoice_number
                ? parseInt(lastFreeSale.invoice_number.split('-')[1]) || 0
                : 0;

            finalInvoiceNumber = `FREE-${(lastNumber + 1).toString().padStart(4, '0')}`;
        }

        // Check if invoice number already exists
        const existingSale = await FreeSale.findOne({ invoice_number: finalInvoiceNumber }).session(session);
        if (existingSale) {
            await session.abortTransaction();
            return sendError(res, "Invoice number already exists", 400);
        }

        // Check if product exists
        const product = await Product.findById(product_id).session(session);
        if (!product) {
            await session.abortTransaction();
            return sendError(res, "Product not found", 404);
        }

        // Process batches and quantity deduction
        const batches = await Batch.find({ product_id }).sort({ expiry: 1 }).session(session);
        let remainingQty = quantity;

        for (const batchItem of batches) {
            if (remainingQty <= 0) break;
            const deductQty = Math.min(batchItem.stock, remainingQty);
            batchItem.stock -= deductQty;
            remainingQty -= deductQty;
            await batchItem.save({ session });
        }

        if (remainingQty > 0) {
            await session.abortTransaction();
            return sendError(res, `Insufficient stock. Only ${quantity - remainingQty} available`, 400);
        }

        let formattedExpiry = null;
        if (expiry) {
            const parts = expiry.split("/");
            if (parts.length === 2) {
                let [month, year] = parts;
                // Handle MM/YY (2-digit year) → expand to YYYY
                if (year.length === 2) {
                    year = `20${year}`;
                }
                const parsed = new Date(`${year}-${month.padStart(2, "0")}-01`);
                if (!isNaN(parsed.getTime())) {
                    formattedExpiry = parsed;
                }
            }
        }

        // Create the sale record
        const newFreeSale = new FreeSale({
            invoice_number: finalInvoiceNumber,
            product_id,
            desc_id,
            sale_person,
            sale_date,
            batch,
            expiry: formattedExpiry,
            quantity,
            sub_total
        });

        const savedFreeSale = await newFreeSale.save({ session });
        await session.commitTransaction();

        // Convert to plain object to remove circular references
        const freeSales = savedFreeSale.toObject();
        return successResponse(res, "Free sale created successfully", { freeSales }, 201);

    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        console.error("Create Free Sale Error:", error);
        return sendError(res, "Failed to create free sale", 500);
    } finally {
        session.endSession();
    }
};

const getAllFreeSales = async (req, res) => {
    try {
        const freeSales = await FreeSale.find()
            .populate({
                path: "product_id",
                select: "name sales_tax sales_tax_percentage retail_price trade_price pack_size_id",
                populate: {
                    path: "pack_size_id",
                    model: "PackSize",
                    select: "name"
                }
            })
            .populate({
                path: "desc_id",
                select: "desc createdAt updatedAt"
            })
            .sort({ createdAt: -1 }); // keep recent first

        return successResponse(res, "Free sales fetched successfully", {
            freeSales: freeSales,
            totalItems: freeSales.length
        });
    } catch (error) {
        console.error("Get Free Sales Error:", error);
        return sendError(res, "Failed to fetch free sales", 500);
    }
};


const getFreeSaleById = async (req, res) => {
    try {
        const { id } = req.params;

        const freeSale = await FreeSale.findById(id)
            .populate("product_id")
            .populate("desc_id");

        if (!freeSale) {
            return sendError(res, "Free sale not found", 404);
        }

        return successResponse(res, "Free sale fetched successfully", { freeSale });
    } catch (error) {
        console.error("Get Free Sale By ID Error:", error);
        return sendError(res, "Failed to fetch free sale", 500);
    }
};

const deleteFreeSale = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;

        // Find the free sale record to be deleted
        const freeSale = await FreeSale.findById(id).session(session);

        if (!freeSale) {
            await session.abortTransaction();
            session.endSession();
            return sendError(res, "Free sale not found", 404);
        }

        // Restore the quantity back to batches
        if (freeSale.quantity > 0) {
            // Find batches for this product (sorted by expiry for FIFO consistency)
            const batches = await Batch.find({ product_id: freeSale.product_id })
                .sort({ expiry: 1 })
                .session(session);

            let remainingQty = freeSale.quantity;

            // Add back to batches (reverse of the deduction logic)
            for (const batchItem of batches) {
                if (remainingQty <= 0) break;

                // For existing batches, we restore to their original stock
                // For the specific batch if provided in the sale, we prioritize that
                if (freeSale.batch && batchItem.batch_number === freeSale.batch) {
                    batchItem.stock += remainingQty;
                    remainingQty = 0;
                } else {
                    // Otherwise distribute evenly or follow your business logic
                    batchItem.stock += remainingQty;
                    remainingQty = 0;
                }

                await batchItem.save({ session });
            }

            // If there's any remaining quantity (shouldn't happen but just in case)
            if (remainingQty > 0) {
                // Create a new batch for the remaining quantity if needed
                const newBatch = new Batch({
                    product_id: freeSale.product_id,
                    batch_number: freeSale.batch || `RESTORED-${Date.now()}`,
                    expiry: freeSale.expiry || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Default 1 year if no expiry
                    stock: remainingQty,
                    purchase_price: 0, // You might want to adjust this
                    mrp: 0 // You might want to adjust this
                });

                await newBatch.save({ session });
            }
        }

        // Delete the free sale record
        await FreeSale.findByIdAndDelete(id).session(session);

        await session.commitTransaction();
        session.endSession();

        return successResponse(res, "Free sale deleted successfully");
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("Delete Free Sale Error:", error);
        return sendError(res, "Failed to delete free sale", 500);
    }
};


const freeSaleController = {
    createFreeSale,
    getAllFreeSales,
    getFreeSaleById,
    deleteFreeSale,
};

export default freeSaleController;