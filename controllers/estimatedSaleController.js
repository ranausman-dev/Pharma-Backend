import { OrderModel as Order } from "../models/orderModel.js";
import { OrderItemModel as OrderItem } from "../models/orderItemModel.js";
import { SupplierModel as Supplier } from "../models/supplierModel.js";
import { BatchModel as Batch } from "../models/batchModel.js";
import { ProductModel as Product } from "../models/productModel.js";
import { User } from "../models/userModel.js";
import { sendError, successResponse } from "../utils/response.js";
import mongoose from "mongoose";

const createEstimatedSale = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const {
            invoice_number,
            estimate_customer_name,
            supplier_id,
            subtotal,
            total,
            paid_amount,
            due_amount,
            net_value,
            due_date,
            estimate_date,
            items,
            type = "estimated",
            status = "completed",
        } = req.body;

        if (type !== "estimated") {
            await session.abortTransaction();
            return sendError(res, "Invalid order type", 400);
        }

        // Directly create the order without verifying customer/product
        const newOrder = await Order.create(
            [
                {
                    invoice_number,
                    estimate_customer_name,
                    supplier_id: supplier_id || null,
                    subtotal,
                    total,
                    paid_amount,
                    due_amount: due_amount ?? (total - paid_amount),
                    net_value,
                    due_date,
                    estimate_date,
                    type,
                    status,
                },
            ],
            { session }
        );

        if (!newOrder?.length) {
            await session.abortTransaction();
            return sendError(res, "Failed to create order", 500);
        }

        const orderItems = [];

        for (const item of items) {
            // Direct save, no product check
            const orderItem = await OrderItem.create(
                [
                    {
                        order_id: newOrder[0]._id,
                        product_id: item.product_id || null,
                        estimate_product_name: item.estimate_product_name,
                        batch: item.batch,
                        expiry: item.expiry,
                        units: item.units,
                        unit_price: item.unit_price,
                        discount: item.discount || 0,
                        total: item.total,
                    },
                ],
                { session }
            );

            orderItems.push(orderItem[0]);
        }

        await session.commitTransaction();

        return successResponse(
            res,
            "Estimated Sale order created successfully",
            {
                order: newOrder[0],
                items: orderItems,
            },
            201
        );
    } catch (error) {
        await session.abortTransaction();
        console.error("Estimated Sale error:", error);
        return sendError(res, error.message);
    } finally {
        session.endSession();
    }
};


// Get all sales by type (sale)
const getAllEstimatedSales = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Step 1: Get all sale orders with pagination
        const estimatedSales = await Order.find({ type: "estimated" })
            .populate("supplier_id", "owner1_name company_name address city phone_number")
            .populate("booker_id", "name")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        // Step 2: Get all orderIds
        const orderIds = estimatedSales.map((order) => order._id);

        // Step 3: Fetch all items for these orders
        const items = await OrderItem.find({ order_id: { $in: orderIds } })
            .populate({
                path: "product_id",
                populate: {
                    path: "pack_size_id",
                    model: "PackSize",
                },
            })
            .lean();

        // Step 4: Group items by order_id
        const itemsByOrder = items.reduce((acc, item) => {
            if (!acc[item.order_id]) acc[item.order_id] = [];
            acc[item.order_id].push(item);
            return acc;
        }, {});

        // Step 5: Attach items to orders
        const ordersWithItems = estimatedSales.map((order) => ({
            ...order,
            items: itemsByOrder[order._id] || [],
        }));

        // Step 6: Pagination metadata
        const totalSales = await Order.countDocuments({ type: "estimated" });
        const totalPages = Math.ceil(totalSales / limit);
        const hasMore = page < totalPages;

        return successResponse(res, "Estimated Sale orders fetched successfully", {
            estimatedSales: ordersWithItems,
            currentPage: page,
            totalPages,
            totalItems: totalSales,
            pageSize: limit,
            hasMore,
        });
    } catch (error) {
        console.error("Get all estimated sale orders error:", error);
        return sendError(res, "Failed to fetch estimated sales orders");
    }
};


// Get one sale by ID
const getEstimatedSaleById = async (req, res) => {
    try {
        const { orderId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return sendError(res, "Invalid order ID", 400);
        }

        const order = await Order.findOne({ _id: orderId, type: "estimated" })
            .populate("supplier_id", "owner1_name company_name address city phone_number")
            .populate("booker_id", "name")
            .lean();

        if (!order) {
            return sendError(res, "Estimated Sale not found", 404);
        }

        const items = await OrderItem.find({ order_id: orderId })
            .populate({
                path: "product_id",
                populate: {
                    path: "pack_size_id",
                    model: "PackSize",
                },
            })
            .lean();

        return successResponse(res, "Estimated Sale fetched successfully", {
            ...order,
            items,
        });
    } catch (error) {
        console.error("Get Estimated Sale by ID error:", error);
        return sendError(res, "Failed to fetch estimated sale");
    }
};

const deleteEstimatedSale = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { orderId } = req.params;

        console.log("orderId", orderId)

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            await session.abortTransaction();
            return sendError(res, 'Invalid order ID', 400);
        }

        // Fetch the order
        const order = await Order.findById(orderId).session(session);
        if (!order) {
            await session.abortTransaction();
            return sendError(res, 'Order not found', 404);
        }

        if (order.type !== 'estimated') {
            await session.abortTransaction();
            return sendError(res, 'Cannot delete: Not a sale order', 400);
        }

        // Fetch order items
        const orderItems = await OrderItem.find({ order_id: orderId }).session(session);

        // Delete order items
        await OrderItem.deleteMany({ order_id: orderId }).session(session);

        // Delete the order
        await Order.findByIdAndDelete(orderId).session(session);

        await session.commitTransaction();
        return successResponse(res, 'Estimated Sale deleted successfully');
    } catch (error) {
        await session.abortTransaction();
        console.error('Delete Estimated Sale Error:', error);
        return sendError(res, error.message || 'Failed to delete sale');
    } finally {
        session.endSession();
    }
};


const updateEstimatedSale = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { orderId } = req.params;
        const {
            invoice_number,
            estimate_customer_name,
            supplier_id,
            subtotal,
            total,
            paid_amount,
            due_amount,
            net_value,
            due_date,
            estimate_date,
            items,
            status,
        } = req.body;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            await session.abortTransaction();
            return sendError(res, "Invalid order ID", 400);
        }

        // Step 1: Find the order
        const existingOrder = await Order.findById(orderId).session(session);
        if (!existingOrder) {
            await session.abortTransaction();
            return sendError(res, "Estimated Sale not found", 404);
        }

        if (existingOrder.type !== "estimated") {
            await session.abortTransaction();
            return sendError(res, "Cannot update: Not an estimated sale", 400);
        }

        // Step 2: Update order fields
        existingOrder.invoice_number = invoice_number || existingOrder.invoice_number;
        existingOrder.estimate_customer_name = estimate_customer_name || existingOrder.estimate_customer_name;
        existingOrder.supplier_id = supplier_id || existingOrder.supplier_id;
        existingOrder.estimate_date = estimate_date !== undefined ? estimate_date : existingOrder.estimate_date;
        existingOrder.subtotal = subtotal ?? existingOrder.subtotal;
        existingOrder.total = total ?? existingOrder.total;
        existingOrder.paid_amount = paid_amount ?? existingOrder.paid_amount;
        existingOrder.due_amount = due_amount ?? (existingOrder.total - existingOrder.paid_amount);
        existingOrder.net_value = net_value ?? existingOrder.net_value;
        existingOrder.due_date = due_date || existingOrder.due_date;
        existingOrder.status = status || existingOrder.status;

        await existingOrder.save({ session });

        // Step 3: Delete old items and re-add new ones
        if (items && Array.isArray(items)) {
            await OrderItem.deleteMany({ order_id: orderId }).session(session);

            const newItems = [];
            for (const item of items) {
                const orderItem = await OrderItem.create(
                    [
                        {
                            order_id: orderId,
                            product_id: item.product_id || null,
                            estimate_product_name: item.estimate_product_name,
                            batch: item.batch,
                            expiry: item.expiry,
                            units: item.units,
                            unit_price: item.unit_price,
                            discount: item.discount || 0,
                            total: item.total,
                        },
                    ],
                    { session }
                );
                newItems.push(orderItem[0]);
            }

            await session.commitTransaction();
            return successResponse(res, "Estimated Sale updated successfully", {
                order: existingOrder,
                items: newItems,
            });
        }

        await session.commitTransaction();
        return successResponse(res, "Estimated Sale updated successfully", {
            order: existingOrder,
        });
    } catch (error) {
        await session.abortTransaction();
        console.error("Update Estimated Sale error:", error);
        return sendError(res, error.message || "Failed to update estimated sale");
    } finally {
        session.endSession();
    }
};

// Export all like you mentioned
const estimatedSaleController = {
    createEstimatedSale,
    getAllEstimatedSales,
    deleteEstimatedSale,
    getEstimatedSaleById,
    updateEstimatedSale
};

export default estimatedSaleController;
