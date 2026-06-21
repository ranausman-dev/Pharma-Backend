import { OrderModel as Order } from "../models/orderModel.js";
import {
  OrderItemModel as OrderItem,
  OrderItemModel,
} from "../models/orderItemModel.js";
import { SupplierModel as Supplier } from "../models/supplierModel.js";
import { BatchModel as Batch } from "../models/batchModel.js";
import { ProductModel as Product } from "../models/productModel.js";
import { User } from "../models/userModel.js";
import { sendError, successResponse } from "../utils/response.js";
import mongoose from "mongoose";
import adjustBalance from "../utils/adjustBalance.js";
import Investor from "../models/investorModel.js";
import investorProfit from "../models/investorProfit.js";

const createSale = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      invoice_number,
      supplier_id, // customer
      booker_id,
      subtotal,
      total,
      paid_amount,
      due_date,
      net_value,
      note,
      items,
      type = "sale",
      status = "completed",
    } = req.body;

    console.log("req.body", req.body);

    // ✅ Validate type (always)
    if (type !== "sale") {
      await session.abortTransaction();
      return sendError(res, "Invalid order type", 400);
    }

    // ✅ Validate supplier (always)
    const supplierDoc = await Supplier.findById(supplier_id).session(session);
    if (!supplierDoc) {
      await session.abortTransaction();
      return sendError(res, "Supplier (Customer) not found", 404);
    }

    // ✅ Validate booker (always)
    if (booker_id) {
      const booker = await User.findById(booker_id).session(session);
      if (!booker) {
        await session.abortTransaction();
        return sendError(res, "Booker not found", 404);
      }
    }

    // ===== COMPLETED-ONLY VALIDATIONS =====
    if (status === "completed") {
      // 1. Validate required fields
      const requiredFields = {
        supplier_id,
        subtotal,
        total,
        paid_amount,
        net_value,
        items,
      };

      const missingFields = Object.entries(requiredFields)
        .filter(
          ([_, value]) =>
            value === undefined ||
            value === null ||
            value === "" ||
            (Array.isArray(value) && value.length === 0),
        )
        .map(([key]) => key);

      if (missingFields.length > 0) {
        await session.abortTransaction();
        return sendError(
          res,
          `Missing required fields: ${missingFields.join(", ")}`,
          400,
        );
      }

      // 2. Validate batch numbers
      for (const item of items) {
        if (!item.batch || item.batch.trim() === "") {
          await session.abortTransaction();
          return sendError(res, `Batch number is required for all items`, 400);
        }
      }

      // 3. Validate product stock
      for (const item of items) {
        const batch = await Batch.findOne({
          product_id: item.product_id,
          batch_number: item.batch,
        }).session(session);

        if (!batch) {
          await session.abortTransaction();
          return sendError(
            res,
            `Batch ${item.batch} not found for product ${item.product_id}`,
            404,
          );
        }

        if (item.units > batch.stock) {
          await session.abortTransaction();
          return sendError(
            res,
            `Insufficient stock in batch ${item.batch}. Available: ${batch.stock}`,
            400,
          );
        }
      }
    }

    // ===== ORDER CREATION (ALWAYS HAPPENS) =====
    const actualDueForOrder = Number(total) - Number(paid_amount);
    const prevPay = supplierDoc.pay || 0;
    const prevReceive = supplierDoc.receive || 0;
    const balanceResult = adjustPayReceive(
      prevPay,
      prevReceive,
      actualDueForOrder,
      0,
    );

    const orderData = {
      invoice_number,
      supplier_id,
      booker_id,
      subtotal,
      total,
      paid_amount,
      due_amount: (balanceResult.pay || 0) - (balanceResult.receive || 0),
      net_value,
      note,
      due_date,
      status,
      type,
      profit: 0,
    };

    const newOrder = await Order.create([orderData], { session });
    console.log("✅ ORDER CREATED WITH STATUS:", newOrder[0].status); // ADD THIS
    console.log("✅ ORDER INVOICE:", newOrder[0].invoice_number); // ADD THIS
    if (!newOrder?.length) {
      await session.abortTransaction();
      return sendError(res, "Failed to create order", 500);
    }

    // ===== ORDER ITEMS (ALWAYS HAPPENS) =====
    const orderItems = [];

    for (const item of items) {
      console.log("item", item);
      const product = await Product.findById(item.product_id).session(session);
      if (!product) {
        await session.abortTransaction();
        return sendError(res, `Product not found: ${item.product_id}`, 404);
      }

      let expiryValue = item.expiry || null;

      const calculatedTotal =
        item.units * item.unit_price - (item.discount || 0);

      const orderItem = await OrderItem.create(
        [
          {
            order_id: newOrder[0]._id,
            product_id: item.product_id,
            batch: item.batch,
            expiry: expiryValue,
            units: item.units,
            unit_price: item.unit_price,
            discount: item.discount || 0,
            profit: 0, // Will be updated for completed orders
            total: calculatedTotal,
            retail_price: product.retail_price,
            trade_price: product.trade_price,
            sales_tax: product.sales_tax,
          },
        ],
        { session },
      );

      orderItems.push(orderItem[0]);
    }

    // ===== DRAFT HANDLING =====
    if (status === "skipped") {
      await session.commitTransaction();
      session.endSession();
      return successResponse(
        res,
        "Draft sale saved successfully (ready for completion later)",
        { order: newOrder[0], items: orderItems },
        201,
      );
    }

    // ===== COMPLETED ORDER PROCESSING =====
    // Everything below only runs for status === "completed"

    const batchUpdates = [];
    let totalOrderProfit = 0;

    // Process items for completed order
    for (const item of items) {
      const batch = await Batch.findOne({
        product_id: item.product_id,
        batch_number: item.batch,
      }).session(session);

      // ✅ CORRECT PROFIT CALCULATION (using pre-tax amount)
      const salePricePerUnitIncludingTax = item.total / item.units;
      const profitPerUnit = salePricePerUnitIncludingTax - batch.unit_cost;
      const totalProfitForItem = profitPerUnit * item.units;

      totalOrderProfit += totalProfitForItem;

      // Update order item with profit (match by product_id AND batch to handle same product in multiple batches)
      await OrderItem.findByIdAndUpdate(
        orderItems.find(
          (oi) =>
            oi.product_id.toString() === item.product_id.toString() &&
            oi.batch === item.batch,
        )._id,
        { profit: totalProfitForItem },
        { session },
      );

      batchUpdates.push({
        updateOne: {
          filter: { product_id: item.product_id, batch_number: item.batch },
          update: { $inc: { stock: -item.units } },
        },
      });
    }

    if (batchUpdates.length) {
      await Batch.bulkWrite(batchUpdates, { session });
    }

    // Update order with total profit calculation
    await Order.findByIdAndUpdate(
      newOrder[0]._id,
      { profit: totalOrderProfit },
      { session },
    );

    // 8. Adjust supplier balances
    function adjustPayReceive(
      currentPay,
      currentReceive,
      addPay = 0,
      addReceive = 0,
    ) {
      let pay = currentPay + addPay;
      let receive = currentReceive + addReceive;

      if (pay > receive) {
        pay = pay - receive;
        receive = 0;
      } else {
        receive = receive - pay;
        pay = 0;
      }

      return { pay, receive };
    }

    const { pay: updatedPay, receive: updatedReceive } = adjustPayReceive(
      prevPay,
      prevReceive,
      actualDueForOrder,
      0,
    );

    await Supplier.findByIdAndUpdate(
      supplier_id,
      { pay: updatedPay, receive: updatedReceive },
      { session },
    );

    // 9. Investor Profit Sharing
    const grossSale = total;
    const expense = grossSale * 0.02;

    const profit = totalOrderProfit;
    const charity = profit * 0.1;
    const distributable = profit - charity - expense;

    const investors = await Investor.find({ status: "active" }).session(
      session,
    );
    const today = new Date();
    const monthKey = `${today.getFullYear()}-${String(
      today.getMonth() + 1,
    ).padStart(2, "0")}`;

    let totalGivenToInvestors = 0;
    let companyRecord = null;

    // Loop investors
    for (const inv of investors) {
      console.log("Checking investor:", inv.name, "Join date:", inv.join_date);

      const joinDate = new Date(inv.join_date);
      let eligible = false;

      if (joinDate <= new Date(today.getFullYear(), today.getMonth(), 1)) {
        eligible = true;
      } else if (
        joinDate.getDate() <= 15 &&
        joinDate.getMonth() === today.getMonth() &&
        joinDate.getFullYear() === today.getFullYear()
      ) {
        eligible = today.getDate() >= 15;
      }

      console.log("Eligible?", eligible);

      if (!eligible) continue;

      // SIMPLE: Investor gets exactly profit_percentage% of total distributable profit
      const invShare = (distributable * (inv.profit_percentage || 0)) / 100;

      // Company gets the rest from this investor's allocation
      const companyShare = (distributable * (inv.shares || 0)) / 100 - invShare;

      console.log("Distributable:", distributable);
      console.log(
        "Investor:",
        inv.name,
        "Shares:",
        inv.shares,
        "Profit %:",
        inv.profit_percentage,
      );
      console.log("InvShare (direct % of total profit):", invShare);
      console.log("Company gets from this investor:", companyShare);

      totalGivenToInvestors += invShare;

      // Save investor profit record
      await investorProfit.create(
        [
          {
            investor_id: inv._id,
            month: monthKey,
            order_id: newOrder[0]._id,
            sales: grossSale,
            gross_profit: profit,
            expense,
            charity,
            net_profit: distributable,
            investor_share: invShare,
            owner_share: companyShare,
            total: grossSale,
          },
        ],
        { session },
      );

      inv.credit = (inv.credit || 0) + invShare;
      await inv.save({ session });

      // Add the company share to company record
      if (companyRecord) {
        companyRecord.credit = (companyRecord.credit || 0) + companyShare;
      }
    }

    // Finally, add company’s own direct share
    if (companyRecord) {
      const companyOwnShare = (distributable * companyRecord.shares) / 100;
      const totalCompanyShare = companyOwnShare + (companyRecord.credit || 0);

      await investorProfit.create(
        [
          {
            investor_id: companyRecord._id,
            month: monthKey,
            order_id: newOrder[0]._id,
            sales: grossSale,
            gross_profit: profit,
            expense,
            charity,
            net_profit: distributable,
            investor_share: 0,
            owner_share: companyOwnShare,
            total: grossSale,
          },
        ],
        { session },
      );

      companyRecord.credit = totalCompanyShare;
      await companyRecord.save({ session });
    }

    await session.commitTransaction();

    return successResponse(
      res,
      "Sale order created successfully",
      {
        order: newOrder[0],
        items: orderItems,
        distributable,
        total_profit: totalOrderProfit,
      },
      201,
    );
  } catch (error) {
    await session.abortTransaction();
    console.error("Sale error:", error);
    return sendError(res, error.message);
  } finally {
    session.endSession();
  }
};

// Get all sales by Customer ID
const getSalesByCustomer = async (req, res) => {
  try {
    const { customerId } = req.params;

    // Check if customer exists
    const customer = await Supplier.findById(customerId);
    if (!customer) {
      return sendError(res, "Customer not found", 404);
    }

    // Get all sales (no pagination)
    const sales = await Order.find({ supplier_id: customerId, type: "sale" })
      .populate("supplier_id", "owner1_name")
      .populate("booker_id", "name")
      .sort({ createdAt: -1 });

    // Get total count
    const totalSales = await Order.countDocuments({
      supplier_id: customerId,
      type: "sale",
    });

    return successResponse(res, "Sales fetched successfully", {
      sales,
      totalSales,
    });
  } catch (error) {
    console.error("Get sales by customer error:", error);
    return sendError(res, "Failed to fetch sales by customer", 500);
  }
};

// Get all sales by type (sale)
const getAllSales = async (req, res) => {
  try {
    // Fetch all sales with supplier and booker populated
    const sales = await Order.find({ type: "sale" })
      .populate({
        path: "supplier_id",
        select: "company_name role address city phone_number pay receive area_id",
        populate: {
          path: "area_id",
          model: "Area",
          select: "name",
        },
      })
      .populate("booker_id", "name")
      .sort({ createdAt: -1 })
      .lean();

    // Fetch all OrderItems for these sales and attach product details
    const saleIds = sales.map((order) => order._id);
    const orderItems = await OrderItem.find({ order_id: { $in: saleIds } })
      .populate({
        path: "product_id",
        select: "name sales_tax sales_tax_percentage pack_size_id product_type retail_price trade_price",
        populate: [
          {
            path: "pack_size_id",
            model: "PackSize",
            select: "name",
          },
          {
            path: "product_type",
            model: "ProductType",
            select: "name",
          },
        ],
      })
      .lean();

    const salesWithItems = sales.map((order) => {
      const items = orderItems.filter(
        (item) => item.order_id.toString() === order._id.toString(),
      );
      return { ...order, items };
    });

    // Initialize totals with counts
    const now = new Date();
    const totals = {
      today: { total: 0, profit: 0, expense: 0, count: 0 },
      weekly: { total: 0, profit: 0, expense: 0, count: 0 },
      monthly: { total: 0, profit: 0, expense: 0, count: 0 },
      yearly: { total: 0, profit: 0, expense: 0, count: 0 },
      all: { total: 0, profit: 0, expense: 0, count: 0 },
    };

    // Week start/end
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // Calculate totals and counts
    sales.forEach((s) => {
      const date = new Date(s.createdAt);
      const total = s.total || 0;
      const profit = s.profit || 0;
      const expense = total * 0.02; // Example: 2% expense

      // All-time
      totals.all.total += total;
      totals.all.profit += profit;
      totals.all.expense += expense;
      totals.all.count += 1;

      // Today
      if (date.toDateString() === now.toDateString()) {
        totals.today.total += total;
        totals.today.profit += profit;
        totals.today.expense += expense;
        totals.today.count += 1;
      }

      // Weekly
      if (date >= weekStart && date <= weekEnd) {
        totals.weekly.total += total;
        totals.weekly.profit += profit;
        totals.weekly.expense += expense;
        totals.weekly.count += 1;
      }

      // Monthly
      if (
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth()
      ) {
        totals.monthly.total += total;
        totals.monthly.profit += profit;
        totals.monthly.expense += expense;
        totals.monthly.count += 1;
      }

      // Yearly
      if (date.getFullYear() === now.getFullYear()) {
        totals.yearly.total += total;
        totals.yearly.profit += profit;
        totals.yearly.expense += expense;
        totals.yearly.count += 1;
      }
    });

    return successResponse(res, "Sale orders fetched successfully", {
      sales: salesWithItems,
      totals,
      totalItems: salesWithItems.length,
    });
  } catch (error) {
    console.error("Get all sale orders error:", error);
    return sendError(res, "Failed to fetch sales orders", 500);
  }
};

// Get all sales for a specific product
const getProductSales = async (req, res) => {
  try {
    const { productId } = req.params;

    // Check if product exists and get product prices
    const product = await Product.findById(productId).select(
      "name item_code retail_price trade_price",
    );
    if (!product) {
      return sendError(res, "Product not found", 404);
    }

    // Get all order items for this product (only sales)
    const orderItems = await OrderItem.aggregate([
      {
        $match: { product_id: new mongoose.Types.ObjectId(productId) },
      },
      {
        $lookup: {
          from: "orders",
          localField: "order_id",
          foreignField: "_id",
          as: "order",
        },
      },
      { $unwind: "$order" },
      {
        $match: { "order.type": "sale" },
      },
      {
        $lookup: {
          from: "suppliers",
          localField: "order.supplier_id",
          foreignField: "_id",
          as: "supplier",
        },
      },
      { $unwind: { path: "$supplier", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          date: "$order.createdAt",
          invoice_number: "$order.invoice_number",
          type: "$order.type",
          supplier: "$supplier.name",
          batch: "$batch",
          expiry: "$expiry",
          units: "$units",
          unit_price: "$unit_price",
          discount: "$discount",
          total: "$total",
          retail_price: product.retail_price,
          trade_price: product.trade_price,
        },
      },
      { $sort: { date: -1 } }, // Sort only
    ]);

    // Calculate stock info
    const stockData = await Batch.aggregate([
      {
        $match: { product_id: new mongoose.Types.ObjectId(productId) },
      },
      {
        $group: {
          _id: null,
          totalStock: { $sum: "$stock" },
          productIn: { $sum: "$stock" },
        },
      },
    ]);

    const productOut = 0; // If needed, calculate from sales data
    const stockInfo =
      stockData.length > 0
        ? stockData[0]
        : {
          totalStock: 0,
          productIn: 0,
        };

    return successResponse(res, "Product sales fetched successfully", {
      sales: orderItems,
      stockInfo: {
        productIn: stockInfo.productIn,
        productOut,
        totalStock: stockInfo.totalStock,
      },
      product: {
        _id: product._id,
        name: product.name,
        item_code: product.item_code,
        retail_price: product.retail_price,
        trade_price: product.trade_price,
      },
    });
  } catch (error) {
    console.error("Get sales by product error:", error);
    return sendError(res, "Failed to fetch product sales", 500);
  }
};

// Helper functions for tracking returns
const getReturnedQuantities = async (invoiceNumber, type) => {
  const returnType = type === "sale" ? "sale_return" : "purchase_return";
  const returnOrders = await Order.find({
    invoice_number: invoiceNumber + "-R",
    type: returnType
  }).select("_id");

  if (!returnOrders.length) return {};

  const returnOrderIds = returnOrders.map(ro => ro._id);
  const returnedItems = await OrderItemModel.find({
    order_id: { $in: returnOrderIds }
  });

  const returnedMap = {};
  for (const item of returnedItems) {
    const productIdStr = item.product_id._id ? item.product_id._id.toString() : item.product_id.toString();
    const key = `${productIdStr}_${item.batch}`;
    returnedMap[key] = (returnedMap[key] || 0) + item.units;
  }
  return returnedMap;
};

const enrichSaleWithReturns = async (sale) => {
  const returnedMap = await getReturnedQuantities(sale.invoice_number, "sale");
  let allFullyReturned = true;
  sale.items = sale.items.map(item => {
    const productIdStr = item.product_id._id ? item.product_id._id.toString() : item.product_id.toString();
    const key = `${productIdStr}_${item.batch}`;
    const alreadyReturned = returnedMap[key] || 0;
    const remainingQty = Math.max(item.units - alreadyReturned, 0);
    if (remainingQty > 0) {
      allFullyReturned = false;
    }
    return {
      ...item,
      alreadyReturned,
      remainingQty
    };
  });
  return { sale, allFullyReturned };
};

// Controller: get sale for return
const getSaleForReturn = async (req, res) => {
  try {
    const { invoice_number, customer_id } = req.query;

    // 🔹 Validate: must have at least one
    if (!invoice_number && !customer_id) {
      return sendError(res, "Provide either invoice number or customer", 400);
    }

    const filter = { type: "sale" };
    if (invoice_number) filter.invoice_number = invoice_number;
    if (customer_id) filter.supplier_id = customer_id; // assuming supplier_id stores customer

    let sales;

    if (invoice_number) {
      const sale = await Order.findOne(filter)
        .populate("supplier_id") // attach customer info
        .populate("booker_id") // attach booker info if needed
        .lean();

      if (!sale) {
        return sendError(res, "Sale order not found", 404);
      }

      // attach items with product info
      sale.items = await OrderItemModel.find({ order_id: sale._id })
        .populate("product_id")
        .lean();

      const { sale: enrichedSale, allFullyReturned } = await enrichSaleWithReturns(sale);
      if (allFullyReturned) {
        return sendError(res, "This invoice is already fully returned", 400);
      }
      sales = enrichedSale;
    } else {
      const rawSales = await Order.find(filter)
        .populate("supplier_id")
        .populate("booker_id")
        .lean();

      if (!rawSales || rawSales.length === 0) {
        return sendError(res, "No sales found for this customer", 404);
      }

      const activeSales = [];
      for (let order of rawSales) {
        order.items = await OrderItemModel.find({ order_id: order._id })
          .populate("product_id")
          .lean();

        const { sale: enrichedSale, allFullyReturned } = await enrichSaleWithReturns(order);
        if (!allFullyReturned) {
          activeSales.push(enrichedSale);
        }
      }

      if (activeSales.length === 0) {
        return sendError(res, "No sales available for return (all invoices are fully returned)", 404);
      }
      sales = activeSales;
    }

    return successResponse(res, "Sale order retrieved", { sales });
  } catch (error) {
    console.error("Get sale error:", error);
    return sendError(res, "Failed to fetch sale order");
  }
};

const returnSaleByInvoice = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { invoice_number, items } = req.body;

    if (!invoice_number || !items?.length) {
      await session.abortTransaction();
      return sendError(res, "Invoice number and items are required", 400);
    }

    // Fetch original sale order
    const saleOrder = await Order.findOne({
      invoice_number,
      type: "sale",
    }).session(session);
    if (!saleOrder) {
      await session.abortTransaction();
      return sendError(res, "Sale order not found", 404);
    }

    // Fetch customer
    const customer = await Supplier.findById(saleOrder.supplier_id).session(
      session,
    );
    if (!customer) {
      await session.abortTransaction();
      return sendError(res, "Customer not found", 404);
    }

    // Get all previous return items for this invoice to compute already returned quantities
    const returnOrders = await Order.find({
      invoice_number: invoice_number + "-R",
      type: "sale_return"
    }).session(session);

    const returnOrderIds = returnOrders.map(ro => ro._id);
    const returnedItems = await OrderItemModel.find({
      order_id: { $in: returnOrderIds }
    }).session(session);

    const returnedMap = {};
    for (const ri of returnedItems) {
      const productIdStr = ri.product_id._id ? ri.product_id._id.toString() : ri.product_id.toString();
      const key = `${productIdStr}_${ri.batch}`;
      returnedMap[key] = (returnedMap[key] || 0) + ri.units;
    }

    let totalReturn = 0;
    let totalReturnWithTax = 0;
    const orderItemsMap = {};

    // Validate items and calculate total return
    for (const item of items) {
      const orderItem = await OrderItem.findOne({
        order_id: saleOrder._id,
        product_id: item.product_id,
        batch: item.batch,
      }).session(session);

      if (!orderItem) {
        await session.abortTransaction();
        return sendError(
          res,
          `Order item not found for batch: ${item.batch}`,
          404,
        );
      }

      const productIdStr = item.product_id.toString();
      const key = `${productIdStr}_${item.batch}`;
      const alreadyReturned = returnedMap[key] || 0;
      const remainingQty = Math.max(orderItem.units - alreadyReturned, 0);

      if (item.units > remainingQty) {
        await session.abortTransaction();
        return sendError(
          res,
          `You can only return the remaining available stock for batch ${item.batch}, which is ${remainingQty} unit(s).`,
          400
        );
      }

      // Calculate total for returned units proportionally
      const unitTotal = orderItem.total / orderItem.units;
      const returnTotal = unitTotal * item.units;
      totalReturn += returnTotal;

      // Include sales tax for refund / customer balance update
      const taxPerUnit = orderItem.sales_tax || 0;
      const returnTotalWithTax = (unitTotal + taxPerUnit) * item.units;
      totalReturnWithTax += returnTotalWithTax;

      orderItemsMap[item.batch] = { orderItem, returnTotal, returnTotalWithTax };
    }

    // Deduct from customer's pay (using tax-inclusive return total)
    await Supplier.findByIdAndUpdate(
      customer._id,
      { pay: Math.max((customer.pay || 0) - totalReturnWithTax, 0) },
      { session },
    );

    // Create return sale order
    const returnOrder = await Order.create(
      [
        {
          invoice_number: invoice_number + "-R",
          supplier_id: customer._id,
          booker_id: saleOrder.booker_id || null,
          subtotal: totalReturnWithTax,
          total: totalReturnWithTax,
          paid_amount: 0,
          due_amount: totalReturnWithTax,
          net_value: totalReturnWithTax,
          type: "sale_return",
          status: "returned",
        },
      ],
      { session },
    );

    const returnItems = [];
    const batchUpdates = [];
    let returnedProfit = 0;

    // Process each return item
    for (const item of items) {
      const { orderItem, returnTotal, returnTotalWithTax } = orderItemsMap[item.batch];

      // Deduct units from original order item
      // orderItem.units -= item.units;
      // await orderItem.save({ session });

      // Calculate proportional profit being returned
      const profitPerUnit = orderItem.units > 0 ? (orderItem.profit || 0) / orderItem.units : 0;
      returnedProfit += profitPerUnit * item.units;
      const product = await Product.findById(item.product_id).session(session);

      // Create return order item
      const returnOrderItem = await OrderItem.create(
        [
          {
            order_id: returnOrder[0]._id,
            product_id: item.product_id,
            batch: item.batch,
            expiry: item.expiry,
            units: item.units,
            unit_price: item.unit_price,
            discount: item.discount || 0,
            total: returnTotal,
            retail_price: product ? product.retail_price : (orderItem.retail_price || 0),
            trade_price: product ? product.trade_price : (orderItem.trade_price || 0),
            sales_tax: product ? product.sales_tax : (orderItem.sales_tax || 0),
          },
        ],
        { session },
      );

      returnItems.push(returnOrderItem[0]);

      // Update batch stock
      batchUpdates.push({
        updateOne: {
          filter: { product_id: item.product_id, batch_number: item.batch },
          update: { $inc: { stock: item.units } },
        },
      });
    }

    if (batchUpdates.length) await Batch.bulkWrite(batchUpdates, { session });

    // ✅ Deduct returned amount and profit from original sale order (using tax-inclusive return total)
    await Order.findByIdAndUpdate(
      saleOrder._id,
      { $inc: { total: -totalReturnWithTax, profit: -returnedProfit } },
      { session },
    );

    await session.commitTransaction();

    return successResponse(
      res,
      "Sale returned successfully",
      {
        returnOrder: returnOrder[0],
        items: returnItems,
      },
      200,
    );
  } catch (error) {
    await session.abortTransaction();
    console.error("Return sale error:", error);
    return sendError(res, "Failed to return sale order");
  } finally {
    session.endSession();
  }
};

// GET all sale returns with their items and totals
export const getAllSaleReturns = async (req, res) => {
  try {
    // Fetch all sale return orders
    const returns = await Order.find({ type: "sale_return" })
      .populate("supplier_id", "_id company_name role")
      .sort({ createdAt: -1 })
      .lean();

    // Populate items for each return order
    const returnIds = returns.map((ret) => ret._id);
    const returnItems = await OrderItem.find({ order_id: { $in: returnIds } })
      .populate({
        path: "product_id",
        select: "name sales_tax sales_tax_percentage pack_size_id product_type retail_price trade_price",
        populate: [
          {
            path: "pack_size_id",
            model: "PackSize",
            select: "name",
          },
          {
            path: "product_type",
            model: "ProductType",
            select: "name",
          },
        ],
      })
      .lean();

    const returnsWithItems = returns.map((ret) => {
      const items = returnItems.filter(
        (item) => item.order_id.toString() === ret._id.toString(),
      );
      return { ...ret, items };
    });

    // Initialize totals
    const now = new Date();
    const totals = {
      today: { total: 0, count: 0 },
      weekly: { total: 0, count: 0 },
      monthly: { total: 0, count: 0 },
      yearly: { total: 0, count: 0 },
      all: { total: 0, count: 0 }, // 👈 all-time totals
    };

    // Week start/end
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // Loop through returns and accumulate totals
    returns.forEach((ret) => {
      const date = new Date(ret.createdAt);
      const total = ret.total || 0;

      // All-time
      totals.all.total += total;
      totals.all.count += 1;

      // Today
      if (date.toDateString() === now.toDateString()) {
        totals.today.total += total;
        totals.today.count += 1;
      }

      // Weekly
      if (date >= weekStart && date <= weekEnd) {
        totals.weekly.total += total;
        totals.weekly.count += 1;
      }

      // Monthly
      if (
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth()
      ) {
        totals.monthly.total += total;
        totals.monthly.count += 1;
      }

      // Yearly
      if (date.getFullYear() === now.getFullYear()) {
        totals.yearly.total += total;
        totals.yearly.count += 1;
      }
    });

    return successResponse(res, "Sale returns fetched successfully", {
      returns: returnsWithItems,
      totals,
      totalItems: returns.length,
    });
  } catch (error) {
    console.error("Error fetching sale returns:", error);
    return sendError(res, "Failed to fetch sale returns");
  }
};

export const getLastSaleTransactionByProduct = async (req, res) => {
  try {
    const { productId, supplierId, batch } = req.query;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "productId is required",
      });
    }

    const itemMatch = {
      product_id: new mongoose.Types.ObjectId(productId),
    };

    if (batch) {
      itemMatch.batch = batch;
    }

    const orderMatch = { type: "sale" };
    if (supplierId && mongoose.Types.ObjectId.isValid(supplierId)) {
      orderMatch.supplier_id = new mongoose.Types.ObjectId(supplierId);
    }

    const lastItem = await OrderItemModel.aggregate([
      { $match: itemMatch },

      // join orders + suppliers
      {
        $lookup: {
          from: "orders",
          localField: "order_id",
          foreignField: "_id",
          as: "order",
          pipeline: [
            { $match: orderMatch },
            {
              $lookup: {
                from: "suppliers",
                localField: "supplier_id",
                foreignField: "_id",
                as: "supplier",
              },
            },
            {
              $unwind: {
                path: "$supplier",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $project: {
                invoice_number: 1,
                createdAt: 1,
                type: 1,
                "supplier.company_name": 1,
              },
            },
          ],
        },
      },
      { $unwind: "$order" },

      // join batches to get CURRENT merged discount
      {
        $lookup: {
          from: "batches",
          let: { pId: "$product_id", bNum: "$batch" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$product_id", "$$pId"] },
                    { $eq: ["$batch_number", "$$bNum"] },
                  ],
                },
              },
            },
            {
              $project: {
                discount_per_unit: 1,
                discount_percentage: 1,
                purchase_price: 1,
              },
            },
          ],
          as: "batchDoc",
        },
      },
      {
        $unwind: {
          path: "$batchDoc",
          preserveNullAndEmptyArrays: true,
        },
      },

      { $sort: { "order.createdAt": -1 } },
      { $limit: 1 },
    ]);

    if (!lastItem.length) {
      return res.status(404).json({
        success: false,
        message: "No previous sale transaction found for this product",
      });
    }

    const item = lastItem[0];

    // ✅ LAST TRANSACTION DISCOUNT
    const lastTransactionDiscount = item.discount || 0;
    const tradePrice = item.unit_price;
    const quantity = item.units;
    const totalAmount = tradePrice * quantity;

    const lastTransactionDiscountPerUnit =
      quantity > 0 ? lastTransactionDiscount / quantity : 0;
    const lastTransactionDiscountPercentage =
      totalAmount > 0 ? (lastTransactionDiscount / totalAmount) * 100 : 0;

    // ✅ CURRENT BATCH DISCOUNT
    const batchDiscountPerUnit = item.batchDoc?.discount_per_unit || 0;
    const batchDiscountPercentage = item.batchDoc?.discount_percentage || 0;

    const data = {
      invoice_number: item.order.invoice_number,
      date: item.order.createdAt,
      supplier: item.order.supplier?.company_name || "N/A",
      type: item.order.type,
      trade_price: tradePrice,
      quantity,
      batch: item.batch,

      // ✅ Last transaction discount
      last_transaction_discount_amount: Number(
        lastTransactionDiscount.toFixed(2),
      ),
      last_transaction_discount_per_unit: Number(
        lastTransactionDiscountPerUnit.toFixed(2),
      ),
      last_transaction_discount_percentage: Number(
        lastTransactionDiscountPercentage.toFixed(2),
      ),

      // ✅ Current batch discount
      batch_discount_per_unit: Number(batchDiscountPerUnit.toFixed(2)),
      batch_discount_percentage: Number(batchDiscountPercentage.toFixed(2)),

      // Legacy fields
      discount_per_unit: Number(lastTransactionDiscountPerUnit.toFixed(2)),
      discount_amount: Number(lastTransactionDiscount.toFixed(2)),
      discount_percentage: Number(lastTransactionDiscountPercentage.toFixed(2)),
    };

    return res.status(200).json({
      success: true,
      message: "Last sale transaction fetched successfully",
      data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch last sale transaction",
      error: error.message,
    });
  }
};

// Get sale by ID
const getSaleById = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return sendError(res, "Invalid order ID", 400);
    }

    // Fetch the sale order
    const saleOrder = await Order.findById(orderId)
      .populate("supplier_id", "company_name owner1_name role pay receive") // attach customer info with balance
      .populate("booker_id", "name") // attach booker info
      .lean();

    if (!saleOrder) {
      return sendError(res, "Sale order not found", 404);
    }

    if (saleOrder.type !== "sale" && saleOrder.type !== "sale_return") {
      return sendError(res, "Not a sale order", 400);
    }

    // Fetch order items with product info
    const items = await OrderItemModel.find({ order_id: orderId })
      .populate({
        path: "product_id",
        select: "name sales_tax sales_tax_percentage pack_size_id product_type retail_price trade_price",
        populate: [
          {
            path: "pack_size_id",
            model: "PackSize",
            select: "name",
          },
          {
            path: "product_type",
            model: "ProductType",
            select: "name",
          },
        ],
      })
      .lean();

    saleOrder.items = items;

    return successResponse(res, "Sale order retrieved successfully", {
      saleOrder,
    });
  } catch (error) {
    console.error("Get sale by ID error:", error);
    return sendError(res, "Failed to fetch sale order");
  }
};

// Get all sales of a specific booker (employee)
const getBookerSales = async (req, res) => {
  try {
    const { bookerId } = req.params;

    // ✅ Validate booker exists
    const booker = await User.findById(bookerId);
    if (!booker) {
      return sendError(res, "Booker not found", 404);
    }

    // Count total sales
    const totalItems = await Order.countDocuments({
      booker_id: bookerId,
      type: "sale",
    });

    // ✅ Fetch all sales for this booker
    const sales = await Order.find({ booker_id: bookerId, type: "sale" })
      .populate("supplier_id", "company_name")
      .populate("booker_id", "name email")
      .sort({ createdAt: -1 })
      .lean();

    // Get order items
    const orderIds = sales.map((s) => s._id);
    const orderItems = await OrderItem.find({ order_id: { $in: orderIds } })
      .populate({
        path: "product_id",
        select: "name sales_tax sales_tax_percentage pack_size_id product_type retail_price trade_price",
        populate: [
          {
            path: "pack_size_id",
            model: "PackSize",
            select: "name",
          },
          {
            path: "product_type",
            model: "ProductType",
            select: "name",
          },
        ],
      })
      .lean();

    // Attach items
    const salesWithItems = sales.map((sale) => ({
      ...sale,
      items: orderItems.filter(
        (item) => item.order_id.toString() === sale._id.toString(),
      ),
    }));

    return successResponse(res, "Booker sales fetched successfully", {
      sales: salesWithItems,
      totalItems,
    });
  } catch (error) {
    console.error("Get Booker Sales error:", error);
    return sendError(res, error.message);
  }
};

// ✅ Add Recovery Controller
// export const addRecover = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const { orderId } = req.params;
//     const { recovery_amount, recovery_date, recovered_by } = req.body; // ✅ include recovered_by

//     if (!recovery_amount || recovery_amount <= 0) {
//       return sendError(res, "Recovery amount must be greater than zero", 400);
//     }

//     if (!recovered_by) {
//       return sendError(res, "Recovered by user ID is required", 400);
//     }

//     // 🔹 Find the order
//     const order = await Order.findById(orderId).session(session);
//     if (!order) {
//       await session.abortTransaction();
//       return sendError(res, "Order not found", 404);
//     }

//     if (order.due_amount < recovery_amount) {
//       await session.abortTransaction();
//       return sendError(
//         res,
//         "Recovery amount cannot be greater than due amount",
//         400
//       );
//     }

//     // 🔹 Find supplier
//     const supplier = await Supplier.findById(order.supplier_id).session(
//       session
//     );
//     if (!supplier) {
//       await session.abortTransaction();
//       return sendError(res, "Supplier not found", 404);
//     }

//     // 🔹 Update Order's due_amount and recovered fields
//     order.due_amount = Number((order.due_amount - recovery_amount).toFixed(2));
//     order.recovered_amount += recovery_amount;
//     order.recovered_date = recovery_date || new Date();
//     order.recovered_by = recovered_by; // ✅ store the user ID who recovered

//     if (order.due_amount <= 0) {
//       order.due_amount = 0;
//       order.status = "recovered";
//     }

//     await order.save({ session });

//     // 🔹 Update Supplier's debit (pay)
//     supplier.pay = (supplier.pay || 0) - recovery_amount;
//     if (supplier.pay < 0) supplier.pay = 0; // safety check
//     await supplier.save({ session });

//     await session.commitTransaction();
//     session.endSession();

//     return successResponse(res, "Recovery added successfully", {
//       sale: order,
//       supplier,
//       recovery: {
//         recovery_amount,
//         recovery_date: recovery_date || new Date(),
//         recovered_by, // ✅ return user ID in response
//       },
//     });
//   } catch (error) {
//     await session.abortTransaction();
//     session.endSession();
//     return sendError(res, "Failed to add recovery", error);
//   }
// };

// ✅ Bulk Recovery Controller — allocate 1 total amount across multiple invoices
export const addRecover = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const {
      orderIds = [],
      total_recovery_amount,
      recovery_date,
      recovered_by,
    } = req.body;
    console.log("req.body:", req.body);

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return sendError(res, "At least one order ID is required", 400);
    }
    if (!total_recovery_amount || total_recovery_amount <= 0) {
      return sendError(
        res,
        "Total recovery amount must be greater than zero",
        400,
      );
    }
    if (!recovered_by) {
      return sendError(res, "Recovered by user ID is required", 400);
    }

    // 🔹 Fetch all orders
    const orders = await Order.find({ _id: { $in: orderIds } }).session(
      session,
    );
    if (orders.length === 0) {
      await session.abortTransaction();
      return sendError(res, "No matching orders found", 404);
    }

    // 🔹 Ensure all orders belong to the same supplier (optional business rule)
    const supplierId = orders[0].supplier_id.toString();
    const allSameSupplier = orders.every(
      (o) => o.supplier_id.toString() === supplierId,
    );
    if (!allSameSupplier) {
      await session.abortTransaction();
      return sendError(
        res,
        "All selected invoices must belong to the same supplier",
        400,
      );
    }

    const supplier = await Supplier.findById(supplierId).session(session);
    if (!supplier) {
      await session.abortTransaction();
      return sendError(res, "Supplier not found", 404);
    }

    // 🔹 Compute total due across these invoices
    const totalDue = orders.reduce(
      (acc, ord) => acc + (ord.due_amount || 0),
      0,
    );
    if (total_recovery_amount > totalDue) {
      await session.abortTransaction();
      return sendError(
        res,
        "Recovery exceeds total due for selected invoices",
        400,
      );
    }

    // 🔹 Distribute the recovery across invoices in order sequence (FIFO by created date)
    const sortedOrders = orders.sort(
      (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
    );
    let remaining = total_recovery_amount;
    const recoveries = [];

    for (const order of sortedOrders) {
      if (remaining <= 0) break;

      const payment = Math.min(order.due_amount, remaining);

      order.due_amount = Number((order.due_amount - payment).toFixed(2));
      order.recovered_amount = (order.recovered_amount || 0) + payment;
      order.recovered_date = recovery_date || new Date();
      order.recovered_by = recovered_by;
      if (order.due_amount <= 0) {
        order.status = "recovered";
        order.due_amount = 0;
      }
      await order.save({ session });

      recoveries.push({
        order_id: order._id,
        recovery_amount: payment,
        recovered_by,
        recovery_date: recovery_date || new Date(),
      });

      remaining -= payment;
    }

    // 🔹 Adjust supplier payable balance
    supplier.pay = (supplier.pay || 0) - total_recovery_amount;
    if (supplier.pay < 0) supplier.pay = 0;
    await supplier.save({ session });

    // 🔹 Optionally log entries in a Recovery collection
    // await Recovery.insertMany(recoveries, { session });

    await session.commitTransaction();
    session.endSession();

    return successResponse(res, "Bulk recovery applied successfully", {
      supplier,
      totalRecovered: total_recovery_amount,
      remainingUnallocated: remaining,
      recoveries,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Bulk Recovery Error:", error);
    return sendError(res, error.message || "Bulk recovery failed");
  }
};

// Get all sales with pagination (only with valid booker_id)
const getAllBookersSales = async (req, res) => {
  try {
    // ✅ Only sales that must have a booker_id
    const filter = {
      type: "sale",
      booker_id: { $exists: true, $ne: null },
    };

    // Count total sales with valid booker_id
    const totalItems = await Order.countDocuments(filter);

    // Fetch sales with supplier + booker populated
    const sales = await Order.find(filter)
      .populate("supplier_id", "company_name receive pay")
      .populate("booker_id", "name email") // ensures booker exists
      .sort({ createdAt: -1 })
      .lean();

    // 🚨 Filter out records where booker_id failed to populate (invalid user)
    const validSales = sales.filter((s) => s.booker_id && s.booker_id._id);

    // Get order items
    const orderIds = validSales.map((s) => s._id);
    const orderItems = await OrderItem.find({ order_id: { $in: orderIds } })
      .populate({
        path: "product_id",
        select: "name sales_tax sales_tax_percentage pack_size_id product_type retail_price trade_price",
        populate: [
          {
            path: "pack_size_id",
            model: "PackSize",
            select: "name",
          },
          {
            path: "product_type",
            model: "ProductType",
            select: "name",
          },
        ],
      })
      .lean();

    // Attach items to their corresponding sales
    const salesWithItems = validSales.map((sale) => ({
      ...sale,
      items: orderItems.filter(
        (item) => item.order_id.toString() === sale._id.toString(),
      ),
    }));

    return successResponse(res, "All Bookers Sales fetched successfully", {
      sales: salesWithItems,
      totalItems,
    });
  } catch (error) {
    console.error("Get All Sales error:", error);
    return sendError(res, error.message);
  }
};

const deleteSale = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      await session.abortTransaction();
      return sendError(res, "Invalid order ID", 400);
    }

    const order = await Order.findById(orderId).session(session);
    if (!order) {
      await session.abortTransaction();
      return sendError(res, "Order not found", 404);
    }

    if (order.type !== "sale") {
      await session.abortTransaction();
      return sendError(res, "Cannot delete: Not a sale order", 400);
    }

    // Restore stock (reverse sale)
    const orderItems = await OrderItem.find({ order_id: orderId }).session(
      session,
    );
    for (const item of orderItems) {
      await Batch.updateOne(
        { product_id: item.product_id, batch_number: item.batch },
        { $inc: { stock: item.units } },
        { session },
      );
    }

    // Restore customer balance
    const supplier = await Supplier.findById(order.supplier_id).session(
      session,
    );
    const { pay, receive } = adjustBalance(
      supplier,
      order.total,
      order.type,
      true,
    );
    await Supplier.findByIdAndUpdate(
      order.supplier_id,
      { pay, receive },
      { session },
    );

    // Delete order + items
    await OrderItem.deleteMany({ order_id: orderId }).session(session);
    await Order.findByIdAndDelete(orderId).session(session);

    await session.commitTransaction();
    return successResponse(res, "Sale deleted successfully");
  } catch (error) {
    await session.abortTransaction();
    console.error("Delete Sale Error:", error);
    return sendError(res, error.message || "Failed to delete sale");
  } finally {
    session.endSession();
  }
};

// PATCH /sale/:orderId/complete
export const completeSale = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const sale = await Order.findById(req.params.orderId).session(session);
    if (!sale) {
      await session.abortTransaction();
      return sendError(res, "Sale not found", 404);
    }

    // 🚫 Already completed
    if (sale.status === "completed") {
      await session.commitTransaction();
      return res.json({ success: true, sale });
    }

    /* =====================================================
       1️⃣ Update allowed fields ONLY
       ===================================================== */
    const allowedFields = [
      "subtotal",
      "total",
      "paid_amount",
      "due_amount",
      "net_value",
      "note",
      "due_date",
      "booker_id",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        sale[field] = req.body[field];
      }
    });

    /* =====================================================
       2️⃣ Generate next invoice number (SALE format)
       ===================================================== */
    // Get ALL completed sale invoices
    const completedInvoices = await Order.find({
      status: "completed",
      type: "sale",
      invoice_number: { $regex: /^SALE-\d+$/ },
    })
      .select("invoice_number")
      .session(session);

    let maxInvoice = 0;

    for (const doc of completedInvoices) {
      const num = parseInt(doc.invoice_number.replace("SALE-", ""), 10);
      if (!isNaN(num) && num > maxInvoice) {
        maxInvoice = num;
      }
    }

    // If last invoice was SAL-10 → next is 11
    const nextNumber = maxInvoice + 1;

    // Safety check
    if (!nextNumber || nextNumber <= 0) {
      await session.abortTransaction();
      return sendError(
        res,
        "Invoice number could not be generated safely",
        400,
      );
    }

    sale.invoice_number = `SALE-${nextNumber}`;
    sale.status = "completed";
    sale.profit = 0; // Will be updated after calculation

    /* =====================================================
       3️⃣ Customer validation & balance update
       ===================================================== */
    const customerDoc = await Supplier.findById(sale.supplier_id).session(
      session,
    );

    if (!customerDoc) {
      await session.abortTransaction();
      return sendError(res, "Customer not found", 404);
    }

    // Calculate due amount for this order
    const completedTotal = sale.total || 0;
    const completedPaid = sale.paid_amount || 0;
    const actualDueForOrder = completedTotal - completedPaid;

    // Helper function for balance calculation
    function adjustPayReceive(
      currentPay,
      currentReceive,
      addPay = 0,
      addReceive = 0,
    ) {
      let pay = currentPay + addPay;
      let receive = currentReceive + addReceive;

      if (pay > receive) {
        pay = pay - receive;
        receive = 0;
      } else {
        receive = receive - pay;
        pay = 0;
      }

      return { pay, receive };
    }

    const { pay: updatedPay, receive: updatedReceive } = adjustPayReceive(
      customerDoc.pay || 0,
      customerDoc.receive || 0,
      actualDueForOrder,
      0,
    );

    await Supplier.findByIdAndUpdate(
      sale.supplier_id,
      { pay: updatedPay, receive: updatedReceive },
      { session },
    );

    // ✅ Override due_amount with calculated due_amount and update createdAt
    sale.due_amount = updatedPay - updatedReceive;
    sale.createdAt = new Date();

    /* =====================================================
       4️⃣ Items & batch stock updates with profit calculation
       ===================================================== */
    const { items = [] } = req.body;
    const orderItems = [];
    const batchUpdates = [];
    let totalOrderProfit = 0;

    for (const item of items) {
      // Validate product exists
      const product = await Product.findById(item.product_id).session(session);
      if (!product) {
        await session.abortTransaction();
        return sendError(res, `Product not found: ${item.product_id}`, 404);
      }

      // Validate batch exists and has sufficient stock
      const batch = await Batch.findOne({
        product_id: item.product_id,
        batch_number: item.batch,
      }).session(session);

      if (!batch) {
        await session.abortTransaction();
        return sendError(
          res,
          `Batch ${item.batch} not found for product ${item.product_id}`,
          404,
        );
      }

      if (item.units > batch.stock) {
        await session.abortTransaction();
        return sendError(
          res,
          `Insufficient stock in batch ${item.batch}. Available: ${batch.stock}`,
          400,
        );
      }

      const expiryValue = item.expiry || null;

      // Find or create order item
      let orderItem = await OrderItem.findOne({
        order_id: sale._id,
        product_id: item.product_id,
        batch: item.batch,
      }).session(session);

      // Calculate profit for this item
      const salePricePerUnitIncludingTax = item.total / item.units;
      const profitPerUnit = salePricePerUnitIncludingTax - batch.unit_cost;
      const totalProfitForItem = profitPerUnit * item.units;
      totalOrderProfit += totalProfitForItem;

      if (orderItem) {
        // Update existing order item
        orderItem.units = item.units;
        orderItem.unit_price = item.unit_price;
        orderItem.discount = item.discount || 0;
        orderItem.total = item.total;
        orderItem.expiry = expiryValue;
        orderItem.profit = totalProfitForItem;
        orderItem.retail_price = product.retail_price;
        orderItem.trade_price = product.trade_price;
        orderItem.sales_tax = product.sales_tax;
        await orderItem.save({ session });
      } else {
        // Create new order item
        [orderItem] = await OrderItem.create(
          [
            {
              order_id: sale._id,
              product_id: item.product_id,
              batch: item.batch,
              expiry: expiryValue,
              units: item.units,
              unit_price: item.unit_price,
              discount: item.discount || 0,
              total: item.total,
              profit: totalProfitForItem,
              retail_price: product.retail_price,
              trade_price: product.trade_price,
              sales_tax: product.sales_tax,
            },
          ],
          { session },
        );
      }

      orderItems.push(orderItem);

      // Prepare batch stock update (reduce stock)
      batchUpdates.push({
        updateOne: {
          filter: { product_id: item.product_id, batch_number: item.batch },
          update: { $inc: { stock: -item.units } },
        },
      });
    }

    // Execute batch stock updates
    if (batchUpdates.length) {
      await Batch.bulkWrite(batchUpdates, { session });
    }

    // Update sale with total profit
    sale.profit = totalOrderProfit;
    sale.updatedAt = new Date();
    await sale.save({ session, timestamps: false });

    /* =====================================================
       5️⃣ Investor Profit Sharing (same as createSale)
       ===================================================== */
    const grossSale = sale.total;
    const expense = grossSale * 0.02;
    const profit = totalOrderProfit;
    const charity = profit * 0.1;
    const distributable = profit - charity - expense;

    const investors = await Investor.find({ status: "active" }).session(
      session,
    );
    const today = new Date();
    const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

    let totalGivenToInvestors = 0;
    let companyRecord = null;

    // Loop investors
    for (const inv of investors) {
      console.log("Checking investor:", inv.name, "Join date:", inv.join_date);

      const joinDate = new Date(inv.join_date);
      let eligible = false;

      if (joinDate <= new Date(today.getFullYear(), today.getMonth(), 1)) {
        eligible = true;
      } else if (
        joinDate.getDate() <= 15 &&
        joinDate.getMonth() === today.getMonth() &&
        joinDate.getFullYear() === today.getFullYear()
      ) {
        eligible = today.getDate() >= 15;
      }

      console.log("Eligible?", eligible);

      if (!eligible) continue;

      // Investor gets exactly profit_percentage% of total distributable profit
      const invShare = (distributable * (inv.profit_percentage || 0)) / 100;

      // Company gets the rest from this investor's allocation
      const companyShare = (distributable * (inv.shares || 0)) / 100 - invShare;

      console.log("Distributable:", distributable);
      console.log(
        "Investor:",
        inv.name,
        "Shares:",
        inv.shares,
        "Profit %:",
        inv.profit_percentage,
      );
      console.log("InvShare:", invShare);
      console.log("Company gets from this investor:", companyShare);

      totalGivenToInvestors += invShare;

      // Save investor profit record
      await investorProfit.create(
        [
          {
            investor_id: inv._id,
            month: monthKey,
            order_id: sale._id,
            sales: grossSale,
            gross_profit: profit,
            expense,
            charity,
            net_profit: distributable,
            investor_share: invShare,
            owner_share: companyShare,
            total: grossSale,
          },
        ],
        { session },
      );

      inv.credit = (inv.credit || 0) + invShare;
      await inv.save({ session });

      // Add the company share to company record
      if (companyRecord) {
        companyRecord.credit = (companyRecord.credit || 0) + companyShare;
      }
    }

    // Finally, add company's own direct share
    if (companyRecord) {
      const companyOwnShare = (distributable * companyRecord.shares) / 100;
      const totalCompanyShare = companyOwnShare + (companyRecord.credit || 0);

      await investorProfit.create(
        [
          {
            investor_id: companyRecord._id,
            month: monthKey,
            order_id: sale._id,
            sales: grossSale,
            gross_profit: profit,
            expense,
            charity,
            net_profit: distributable,
            investor_share: 0,
            owner_share: companyOwnShare,
            total: grossSale,
          },
        ],
        { session },
      );

      companyRecord.credit = totalCompanyShare;
      await companyRecord.save({ session });
    }

    /* =====================================================
       6️⃣ Save & commit
       ===================================================== */
    await session.commitTransaction();

    return res.json({
      success: true,
      message: "Sale completed successfully",
      sale,
      items: orderItems,
      distributable,
      total_profit: totalOrderProfit,
    });
  } catch (err) {
    await session.abortTransaction();
    console.error("Complete sale error:", err);
    return sendError(res, err.message || "Something went wrong");
  } finally {
    session.endSession();
  }
};

// ✅ Edit / Update Sale
const editSale = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      await session.abortTransaction();
      return sendError(res, "Invalid order ID", 400);
    }

    const sale = await Order.findById(orderId).session(session);

    if (!sale) {
      await session.abortTransaction();
      return sendError(res, "Sale not found", 404);
    }

    if (sale.type !== "sale") {
      await session.abortTransaction();
      return sendError(res, "Not a sale order", 400);
    }

    const getIdString = (value) => {
      if (!value) return null;
      if (value._id) return value._id.toString();
      return value.toString();
    };

    const normalizePayReceive = (pay = 0, receive = 0) => {
      pay = Number(pay) || 0;
      receive = Number(receive) || 0;

      if (pay > receive) {
        return { pay: Number((pay - receive).toFixed(2)), receive: 0 };
      }

      if (receive > pay) {
        return { pay: 0, receive: Number((receive - pay).toFixed(2)) };
      }

      return { pay: 0, receive: 0 };
    };

    const applySaleDue = async (customerId, amount) => {
      const customer = await Supplier.findById(customerId).session(session);
      if (!customer) throw new Error("Customer not found");

      const result = normalizePayReceive(
        Number(customer.pay || 0) + Number(amount || 0),
        Number(customer.receive || 0)
      );

      await Supplier.findByIdAndUpdate(
        customerId,
        { pay: result.pay, receive: result.receive },
        { session }
      );

      return result;
    };

    const reverseSaleDue = async (customerId, amount) => {
      const customer = await Supplier.findById(customerId).session(session);
      if (!customer) throw new Error("Customer not found");

      const result = normalizePayReceive(
        Number(customer.pay || 0),
        Number(customer.receive || 0) + Number(amount || 0)
      );

      await Supplier.findByIdAndUpdate(
        customerId,
        { pay: result.pay, receive: result.receive },
        { session }
      );

      return result;
    };

    const oldCustomerId = getIdString(sale.supplier_id);
    const newCustomerId = getIdString(req.body.supplier_id || sale.supplier_id);

    if (!newCustomerId || !mongoose.Types.ObjectId.isValid(newCustomerId)) {
      await session.abortTransaction();
      return sendError(res, "Invalid customer ID", 400);
    }

    const customerExists = await Supplier.findById(newCustomerId).session(session);
    if (!customerExists) {
      await session.abortTransaction();
      return sendError(res, "Customer not found", 404);
    }

    const oldTotal = Number(sale.total) || 0;
    const oldPaidAmount = Number(sale.paid_amount) || 0;
    const oldInvoiceDue = Math.max(0, oldTotal - oldPaidAmount);

    const newTotal = Number(req.body.total ?? sale.total) || 0;
    const newPaidAmount = Number(req.body.paid_amount ?? sale.paid_amount) || 0;
    const newInvoiceDue = Math.max(0, newTotal - newPaidAmount);

    const dueDiff = newInvoiceDue - oldInvoiceDue;
    const oldStatus = sale.status;
    const newStatus = req.body.status || sale.status;

    // 1. Reverse old stock and old customer balance (Only if oldStatus was completed)
    if (oldStatus === "completed") {
      const oldItems = await OrderItem.find({ order_id: orderId }).session(session);
      for (const item of oldItems) {
        await Batch.findOneAndUpdate(
          {
            product_id: item.product_id,
            batch_number: item.batch,
          },
          {
            $inc: { stock: Number(item.units || 0) },
          },
          { session }
        );
      }

      if (oldCustomerId) {
        await reverseSaleDue(oldCustomerId, oldInvoiceDue);
      }
    }

    // Delete old items always
    await OrderItem.deleteMany({ order_id: orderId }).session(session);

    // 2. Customer debit/credit adjustment (Only if newStatus is completed)
    if (newStatus === "completed") {
      await applySaleDue(newCustomerId, newInvoiceDue);
    }

    const updatedCustomerAfterBalance = await Supplier.findById(newCustomerId).session(session);

    // 3. Update sale header
    let disableTimestamps = false;
    if (oldStatus === "skipped" && newStatus === "completed") {
      let isDraftInvoice = !sale.invoice_number || !sale.invoice_number.startsWith("SALE-");
      if (req.body.invoice_number && req.body.invoice_number.startsWith("SALE-")) {
        isDraftInvoice = false;
      }

      if (isDraftInvoice) {
        const completedInvoices = await Order.find({
          status: "completed",
          type: "sale",
          invoice_number: { $regex: /^SALE-\d+$/ },
        })
          .select("invoice_number")
          .session(session);

        let maxInvoice = 0;
        for (const doc of completedInvoices) {
          const num = parseInt(doc.invoice_number.replace("SALE-", ""), 10);
          if (!isNaN(num) && num > maxInvoice) {
            maxInvoice = num;
          }
        }
        const nextNumber = maxInvoice + 1;
        sale.invoice_number = `SALE-${nextNumber}`;
      } else {
        sale.invoice_number = req.body.invoice_number || sale.invoice_number;
      }

      // ✅ Update createdAt when completing a draft!
      sale.createdAt = new Date();
      sale.updatedAt = new Date();
      disableTimestamps = true;
    } else {
      sale.invoice_number = req.body.invoice_number ?? sale.invoice_number;
    }

    sale.supplier_id = newCustomerId;
    sale.booker_id = req.body.booker_id ?? sale.booker_id;
    sale.subtotal = req.body.subtotal ?? sale.subtotal;
    sale.total = newTotal;
    sale.paid_amount = newPaidAmount;

    if (newStatus === "completed") {
      sale.due_amount = Number((updatedCustomerAfterBalance?.pay || 0) - (updatedCustomerAfterBalance?.receive || 0));
    } else {
      sale.due_amount = req.body.due_amount ?? newInvoiceDue;
    }

    sale.net_value = req.body.net_value ?? sale.net_value;
    sale.due_date = req.body.due_date ?? sale.due_date;
    sale.note = req.body.note ?? sale.note;
    sale.status = newStatus;

    await sale.save({ session, ...(disableTimestamps ? { timestamps: false } : {}) });

    // 4. Recreate items, deduct stock (only if newStatus is completed), compute profit
    const newItems = [];
    const batchUpdates = [];
    let totalOrderProfit = 0;

    if (Array.isArray(req.body.items)) {
      for (const item of req.body.items) {
        const product = await Product.findById(item.product_id).session(session);

        if (!product) {
          await session.abortTransaction();
          return sendError(res, `Product not found: ${item.product_id}`, 404);
        }

        const batch = await Batch.findOne({
          product_id: item.product_id,
          batch_number: item.batch,
        }).session(session);

        if (!batch) {
          await session.abortTransaction();
          return sendError(
            res,
            `Batch ${item.batch} not found for product ${item.product_id}`,
            404
          );
        }

        let totalProfitForItem = 0;

        if (newStatus === "completed") {
          if (Number(item.units || 0) > Number(batch.stock || 0)) {
            await session.abortTransaction();
            return sendError(
              res,
              `Insufficient stock in batch ${item.batch}. Available: ${batch.stock}`,
              400
            );
          }

          const salePricePerUnit =
            Number(item.units || 0) > 0
              ? Number(item.total || 0) / Number(item.units)
              : 0;

          const profitPerUnit = salePricePerUnit - Number(batch.unit_cost || 0);
          totalProfitForItem = profitPerUnit * Number(item.units || 0);
          totalOrderProfit += totalProfitForItem;

          batchUpdates.push({
            updateOne: {
              filter: {
                product_id: item.product_id,
                batch_number: item.batch,
              },
              update: {
                $inc: { stock: -Number(item.units || 0) },
              },
            },
          });
        }

        const [newItem] = await OrderItem.create(
          [
            {
              order_id: sale._id,
              product_id: item.product_id,
              batch: item.batch,
              expiry: item.expiry || null,
              units: item.units,
              unit_price: item.unit_price,
              discount: item.discount || 0,
              total: item.total,
              profit: totalProfitForItem,
              retail_price: product.retail_price,
              trade_price: product.trade_price,
              sales_tax: product.sales_tax,
            },
          ],
          { session }
        );

        newItems.push(newItem);
      }

      if (batchUpdates.length) {
        await Batch.bulkWrite(batchUpdates, { session });
      }
    }

    sale.profit = totalOrderProfit;
    await sale.save({ session });

    // 5. Investor Profit Sharing (Only if transition is skipped -> completed)
    let distributable = 0;
    if (oldStatus === "skipped" && newStatus === "completed") {
      const grossSale = sale.total;
      const expense = grossSale * 0.02;
      const profit = totalOrderProfit;
      const charity = profit * 0.1;
      distributable = profit - charity - expense;

      const investors = await Investor.find({ status: "active" }).session(session);
      const today = new Date();
      const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

      let companyRecord = null;

      for (const inv of investors) {
        if (inv.name === "Company") {
          companyRecord = inv;
          continue;
        }
        const joinDate = new Date(inv.join_date);
        let eligible = false;

        if (joinDate <= new Date(today.getFullYear(), today.getMonth(), 1)) {
          eligible = true;
        } else if (
          joinDate.getDate() <= 15 &&
          joinDate.getMonth() === today.getMonth() &&
          joinDate.getFullYear() === today.getFullYear()
        ) {
          eligible = today.getDate() >= 15;
        }

        if (!eligible) continue;

        const invShare = (distributable * (inv.profit_percentage || 0)) / 100;
        const companyShare = (distributable * (inv.shares || 0)) / 100 - invShare;

        await investorProfit.create(
          [
            {
              investor_id: inv._id,
              month: monthKey,
              order_id: sale._id,
              sales: grossSale,
              gross_profit: profit,
              expense,
              charity,
              net_profit: distributable,
              investor_share: invShare,
              owner_share: companyShare,
              total: grossSale,
            },
          ],
          { session }
        );

        inv.credit = (inv.credit || 0) + invShare;
        await inv.save({ session });

        if (companyRecord) {
          companyRecord.credit = (companyRecord.credit || 0) + companyShare;
        }
      }

      if (companyRecord) {
        const companyOwnShare = (distributable * companyRecord.shares) / 100;
        const totalCompanyShare = companyOwnShare + (companyRecord.credit || 0);

        await investorProfit.create(
          [
            {
              investor_id: companyRecord._id,
              month: monthKey,
              order_id: sale._id,
              sales: grossSale,
              gross_profit: profit,
              expense,
              charity,
              net_profit: distributable,
              investor_share: 0,
              owner_share: companyOwnShare,
              total: grossSale,
            },
          ],
          { session }
        );

        companyRecord.credit = totalCompanyShare;
        await companyRecord.save({ session });
      }
    }

    await session.commitTransaction();

    return successResponse(res, "Sale updated successfully", {
      order: sale,
      items: newItems,
      balance_adjustment: {
        old_invoice_due: oldInvoiceDue,
        new_invoice_due: newInvoiceDue,
        difference: dueDiff,
        customer_total_debit: Number(updatedCustomerAfterBalance?.pay || 0),
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("❌ Edit sale error:", error);
    return sendError(res, error.message || "Failed to edit sale");
  } finally {
    session.endSession();
  }
};

// Export all like you mentioned
const saleController = {
  createSale,
  getAllSales,
  addRecover,
  getSalesByCustomer,
  getProductSales,
  getSaleForReturn,
  getAllSaleReturns,
  returnSaleByInvoice,
  getSaleById,
  getBookerSales,
  getAllBookersSales,
  deleteSale,
  getLastSaleTransactionByProduct,
  completeSale,
  editSale,
};

export default saleController;