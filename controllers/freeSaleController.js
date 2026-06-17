import mongoose from "mongoose";
import FreeSale from "../models/freeSaleModel.js";
import { BatchModel as Batch } from "../models/batchModel.js";
import { successResponse, sendError } from "../utils/response.js";
import { ProductModel as Product } from "../models/productModel.js";

const createFreeSale = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        await session.startTransaction();

        const { invoice_number, desc_id, sale_person, sale_date, items, product_id, batch, expiry, quantity, sub_total } = req.body;

        // Normalize items array
        let itemsToProcess = [];
        if (items && Array.isArray(items)) {
            itemsToProcess = items;
        } else {
            // Backward compatibility
            itemsToProcess = [{
                product_id,
                batch,
                expiry,
                quantity,
                sub_total
            }];
        }

        if (itemsToProcess.length === 0) {
            await session.abortTransaction();
            return sendError(res, "At least one item is required", 400);
        }

        // Validate items
        for (const item of itemsToProcess) {
            if (!item.product_id || !item.quantity) {
                await session.abortTransaction();
                return sendError(res, "Product ID and quantity are required for all items", 400);
            }
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
        } else {
            // Check if invoice number already exists
            const existingSale = await FreeSale.findOne({ invoice_number: finalInvoiceNumber }).session(session);
            if (existingSale) {
                await session.abortTransaction();
                return sendError(res, "Invoice number already exists", 400);
            }
        }

        const itemsToSave = [];

        for (const item of itemsToProcess) {
            const { product_id: itemId, batch: itemBatch, expiry: itemExpiry, quantity: itemQty, sub_total: itemSubTotal, discount: itemDiscount } = item;

            // Check if product exists
            const product = await Product.findById(itemId).session(session);
            if (!product) {
                await session.abortTransaction();
                return sendError(res, `Product not found for ID: ${itemId}`, 404);
            }

            // Process batches and quantity deduction
            const batches = await Batch.find({ product_id: itemId }).sort({ expiry: 1 }).session(session);
            let remainingQty = itemQty;

            for (const batchItem of batches) {
                if (remainingQty <= 0) break;
                const deductQty = Math.min(batchItem.stock, remainingQty);
                batchItem.stock -= deductQty;
                remainingQty -= deductQty;
                await batchItem.save({ session });
            }

            if (remainingQty > 0) {
                await session.abortTransaction();
                return sendError(res, `Insufficient stock for product ${product.name}. Only ${itemQty - remainingQty} available`, 400);
            }

            let formattedExpiry = null;
            if (itemExpiry) {
                const parts = String(itemExpiry).split("/");
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
                } else {
                    const parsed = new Date(itemExpiry);
                    if (!isNaN(parsed.getTime())) {
                        formattedExpiry = parsed;
                    }
                }
            }

            itemsToSave.push({
                product_id: itemId,
                batch: itemBatch,
                expiry: formattedExpiry,
                quantity: itemQty,
                sub_total: itemSubTotal,
                discount: Number(itemDiscount) || 0
            });
        }

        // Create the single sale record containing the items array
        const newFreeSale = new FreeSale({
            invoice_number: finalInvoiceNumber,
            desc_id,
            sale_person,
            sale_date,
            items: itemsToSave,
            // Root fields populated with first item and aggregated values for backward compatibility
            product_id: itemsToSave[0]?.product_id,
            batch: itemsToSave[0]?.batch,
            expiry: itemsToSave[0]?.expiry,
            quantity: itemsToSave.reduce((sum, i) => sum + i.quantity, 0),
            sub_total: itemsToSave.reduce((sum, i) => sum + i.sub_total, 0),
            discount: itemsToSave.reduce((sum, i) => sum + (i.discount || 0), 0),
        });

        const savedFreeSale = await newFreeSale.save({ session });
        await session.commitTransaction();

        return successResponse(res, "Free sale created successfully", { 
            freeSales: savedFreeSale.toObject()
        }, 201);

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
                path: "items.product_id",
                select: "name sales_tax sales_tax_percentage retail_price trade_price pack_size_id",
                populate: {
                    path: "pack_size_id",
                    model: "PackSize",
                    select: "name"
                }
            })
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

        // Normalize documents to ensure items array is populated for old flat entries
        const normalizedSales = freeSales.map(sale => {
            const obj = sale.toObject();
            if (!obj.items || obj.items.length === 0) {
                obj.items = [{
                    _id: obj._id,
                    product_id: obj.product_id,
                    batch: obj.batch,
                    expiry: obj.expiry,
                    quantity: obj.quantity,
                    sub_total: obj.sub_total,
                    discount: obj.discount || 0
                }];
            }
            return obj;
        });

        return successResponse(res, "Free sales fetched successfully", {
            freeSales: normalizedSales,
            totalItems: normalizedSales.length
        });
    } catch (error) {
        console.error("Get Free Sales Error:", error);
        return sendError(res, "Failed to fetch free sales", 500);
    }
};

const getFreeSaleById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendError(res, "Invalid free sale ID", 400);
        }

        const mainFreeSale = await FreeSale.findById(id)
            .populate({
                path: "items.product_id",
                populate: {
                    path: "pack_size_id",
                    model: "PackSize",
                    select: "name"
                }
            })
            .populate({
                path: "product_id",
                populate: {
                    path: "pack_size_id",
                    model: "PackSize",
                    select: "name"
                }
            })
            .populate("desc_id")
            .lean();

        if (!mainFreeSale) {
            return sendError(res, "Free sale not found", 404);
        }

        // Normalize if it's an old flat entry
        const freeSale = { ...mainFreeSale };
        if (!freeSale.items || freeSale.items.length === 0) {
            // Fetch all other items sharing the same invoice number (old style)
            const allItems = await FreeSale.find({ invoice_number: mainFreeSale.invoice_number })
                .populate({
                    path: "product_id",
                    populate: {
                        path: "pack_size_id",
                        model: "PackSize",
                        select: "name"
                    }
                })
                .populate("desc_id")
                .lean();

            freeSale.items = allItems.map(item => ({
                _id: item._id,
                product_id: item.product_id,
                batch: item.batch,
                expiry: item.expiry,
                quantity: item.quantity,
                sub_total: item.sub_total,
                discount: item.discount || 0,
                sale_person: item.sale_person
            }));
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

        // Get the list of items to restore
        let itemsToRestore = [];
        if (freeSale.items && freeSale.items.length > 0) {
            itemsToRestore = freeSale.items;
        } else {
            // Backward compatibility: get all flat records with the same invoice number
            const flatRecords = await FreeSale.find({ invoice_number: freeSale.invoice_number }).session(session);
            itemsToRestore = flatRecords;
        }

        // Restore the quantity back to batches
        for (const item of itemsToRestore) {
            const quantity = item.quantity || 0;
            const productId = item.product_id;
            const batchNo = item.batch;
            const expiry = item.expiry;

            if (quantity > 0 && productId) {
                const batches = await Batch.find({ product_id: productId })
                    .sort({ expiry: 1 })
                    .session(session);

                let remainingQty = quantity;

                for (const batchItem of batches) {
                    if (remainingQty <= 0) break;

                    if (batchNo && batchItem.batch_number === batchNo) {
                        batchItem.stock += remainingQty;
                        remainingQty = 0;
                    } else {
                        batchItem.stock += remainingQty;
                        remainingQty = 0;
                    }

                    await batchItem.save({ session });
                }

                if (remainingQty > 0) {
                    const newBatch = new Batch({
                        product_id: productId,
                        batch_number: batchNo || `RESTORED-${Date.now()}`,
                        expiry: expiry || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                        stock: remainingQty,
                        purchase_price: 0,
                        mrp: 0
                    });

                    await newBatch.save({ session });
                }
            }
        }

        // Delete the free sale record(s)
        if (freeSale.items && freeSale.items.length > 0) {
            await FreeSale.findByIdAndDelete(id).session(session);
        } else {
            // Delete all flat records sharing the same invoice number (old style)
            await FreeSale.deleteMany({ invoice_number: freeSale.invoice_number }).session(session);
        }

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