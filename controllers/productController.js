import { successResponse, sendError } from "../utils/response.js";
import { ProductModel as Product } from "../models/productModel.js";
import { OrderModel as Order } from "../models/orderModel.js";
import { OrderItemModel as OrderItem } from "../models/orderItemModel.js";
import { BatchModel as Batch } from "../models/batchModel.js";
import { SupplierModel as Supplier } from "../models/supplierModel.js";
import mongoose from "mongoose";


export const createProduct = async (req, res) => {
  try {
    const {
      company_id,
      generic_id,
      name,
      pack_size_id,
      carton_size,
      quantity_alert,
      barcode_symbology,
      item_code,
      product_type,
      retail_price,
      trade_price,
      trade_price_percentage,
      wholesale_price,
      wholesale_price_percentage,
      federal_tax,
      federal_tax_percentage,
      gst,
      gst_percentage,
      sales_tax,
      sales_tax_percentage,
    } = req.body;

    // ✅ Required fields validation
    if (!name) {
      return sendError(
        res,
        "Name is required fields",
        400
      );
    }

    // ✅ Check for duplicate product name (case-insensitive)
    const existingProduct = await Product.findOne({ name: new RegExp(`^${name}$`, 'i') });
    if (existingProduct) {
      return sendError(res, "A product with this name already exists", 409); // 409 Conflict
    }

    const product = await Product.create({
      company_id,
      generic_id,
      name,
      pack_size_id,
      carton_size: carton_size || "",
      quantity_alert: quantity_alert || 0,
      barcode_symbology: barcode_symbology || "",
      item_code: item_code || "",
      product_type,
      retail_price,
      trade_price: trade_price || 0,
      trade_price_percentage: trade_price_percentage || 0,
      wholesale_price: wholesale_price || 0,
      wholesale_price_percentage: wholesale_price_percentage || 0,
      federal_tax: federal_tax || 0,
      federal_tax_percentage: federal_tax_percentage || 0,
      gst: gst || 0,
      gst_percentage: gst_percentage || 0,
      sales_tax: sales_tax || 0,
      sales_tax_percentage: sales_tax_percentage || 0,
    });

    return successResponse(res, "Product created successfully", { product }, 201);
  } catch (error) {
    console.error("Create Product Error:", error);
    return sendError(res, "Failed to create product", 500);
  }
};


export const getAllProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    const products = await Product.aggregate([
      // Lookup Company
      {
        $lookup: {
          from: "companies",
          localField: "company_id",
          foreignField: "_id",
          as: "company"
        }
      },
      { $unwind: { path: "$company", preserveNullAndEmptyArrays: true } },

      // Lookup Generic
      {
        $lookup: {
          from: "generics",
          localField: "generic_id",
          foreignField: "_id",
          as: "generic"
        }
      },
      { $unwind: { path: "$generic", preserveNullAndEmptyArrays: true } },

      // Lookup Product Type
      {
        $lookup: {
          from: "producttypes",
          localField: "product_type",
          foreignField: "_id",
          as: "productType"
        }
      },
      { $unwind: { path: "$productType", preserveNullAndEmptyArrays: true } },

      // Lookup Pack Size
      {
        $lookup: {
          from: "packsizes",
          localField: "pack_size_id",
          foreignField: "_id",
          as: "packSize"
        }
      },
      { $unwind: { path: "$packSize", preserveNullAndEmptyArrays: true } },

      // Lookup Batches
      {
        $lookup: {
          from: "batches",
          localField: "_id",
          foreignField: "product_id",
          as: "batches"
        }
      },

      // Lookup Purchase Order Items
      {
        $lookup: {
          from: "orderitems",
          localField: "_id",
          foreignField: "product_id",
          as: "purchaseItems",
          pipeline: [
            {
              $lookup: {
                from: "orders",
                localField: "order_id",
                foreignField: "_id",
                as: "order"
              }
            },
            { $unwind: "$order" },
            { $match: { "order.type": "purchase" } }
          ]
        }
      },

      // Lookup Sale Order Items
      {
        $lookup: {
          from: "orderitems",
          localField: "_id",
          foreignField: "product_id",
          as: "saleItems",
          pipeline: [
            {
              $lookup: {
                from: "orders",
                localField: "order_id",
                foreignField: "_id",
                as: "order"
              }
            },
            { $unwind: "$order" },
            { $match: { "order.type": "sale" } }
          ]
        }
      },

      // Add calculated fields
      {
        $addFields: {
          // Current stock from batches
          stock: {
            $sum: {
              $map: {
                input: "$batches",
                as: "batch",
                in: { $ifNull: ["$$batch.stock", 0] }
              }
            }
          },
          // Total purchased units
          totalPurchased: {
            $sum: {
              $map: {
                input: "$purchaseItems",
                as: "item",
                in: { $ifNull: ["$$item.units", 0] }
              }
            }
          },
          // Total sold units
          totalSold: {
            $sum: {
              $map: {
                input: "$saleItems",
                as: "item",
                in: { $ifNull: ["$$item.units", 0] }
              }
            }
          },
          // Remaining stock (purchased - sold)
          remainingStock: {
            $subtract: [
              {
                $sum: {
                  $map: {
                    input: "$purchaseItems",
                    as: "item",
                    in: { $ifNull: ["$$item.units", 0] }
                  }
                }
              },
              {
                $sum: {
                  $map: {
                    input: "$saleItems",
                    as: "item",
                    in: { $ifNull: ["$$item.units", 0] }
                  }
                }
              }
            ]
          }
          ,
          // Compute last purchase info (price and discount%) without exposing full purchase object
          lastPurchaseTradePrice: {
            $let: {
              vars: {
                lastItem: { $arrayElemAt: [{ $sortArray: { input: "$purchaseItems", sortBy: { "order.createdAt": -1 } } }, 0] }
              },
              in: { $ifNull: ["$$lastItem.unit_price", 0] }
            }
          },
          lastPurchasePrice: {
            $let: {
              vars: {
                lastItem: { $arrayElemAt: [{ $sortArray: { input: "$purchaseItems", sortBy: { "order.createdAt": -1 } } }, 0] }
              },
              in: {
                $let: {
                  vars: {
                    units: { $ifNull: ["$$lastItem.units", 0] },
                    total: { $ifNull: ["$$lastItem.total", 0] }
                  },
                  in: {
                    $cond: [
                      { $gt: ["$$units", 0] },
                      { $round: [{ $divide: ["$$total", "$$units"] }, 2] },
                      0
                    ]
                  }
                }
              }
            }
          },
          lastPurchaseDiscountPercentage: {
            $let: {
              vars: {
                lastItem: { $arrayElemAt: [{ $sortArray: { input: "$purchaseItems", sortBy: { "order.createdAt": -1 } } }, 0] }
              },
              in: {
                $let: {
                  vars: {
                    totalBeforeDiscount: { $multiply: [{ $ifNull: ["$$lastItem.unit_price", 0] }, { $ifNull: ["$$lastItem.units", 0] }] }
                  },
                  in: {
                    $cond: [
                      { $gt: ["$$totalBeforeDiscount", 0] },
                      { $round: [{ $multiply: [{ $divide: [{ $ifNull: ["$$lastItem.discount", 0] }, "$$totalBeforeDiscount"] }, 100] }, 2] },
                      0
                    ]
                  }
                }
              }
            }
          }
        }
      },

      // Project only necessary fields
      {
        $project: {
          name: 1,
          item_code: 1,
          company: { name: 1 },
          generic: { name: 1 },
          productType: { name: 1 },
          packSize: { name: 1 },
          retail_price: 1,
          trade_price: 1,
          trade_price_percentage: 1,
          wholesale_price: 1,
          wholesale_price_percentage: 1,
          federal_tax: 1,
          federal_tax_percentage: 1,
          gst: 1,
          gst_percentage: 1,
          sales_tax: 1,
          sales_tax_percentage: 1,
          stock: 1,
          totalPurchased: 1,
          totalSold: 1,
          remainingStock: 1,
          batches: {
            $map: {
              input: "$batches",
              as: "batch",
              in: {
                batch_number: "$$batch.batch_number",
                expiry_date: "$$batch.expiry_date",
                discount_per_unit: "$$batch.discount_per_unit",
                unit_cost: "$$batch.unit_cost",
                stock: "$$batch.stock"
              }
            }
          }
          ,
          // Expose only last purchase price and computed discount percentage
          lastPurchasePrice: 1,
          lastPurchaseTradePrice: 1,
          lastPurchaseDiscountPercentage: 1
        }
      },

      // Pagination
      { $skip: skip },
      { $limit: limit }
    ]);

    // Get total products count
    const totalProducts = await Product.countDocuments();
    const totalPages = Math.ceil(totalProducts / limit);
    const hasMore = page < totalPages;

    return successResponse(res, "Products fetched successfully", {
      products,
      currentPage: page,
      totalPages,
      totalItems: totalProducts,
      pageSize: limit,
      hasMore
    });
  } catch (error) {
    console.error("Get Products Error:", error);
    return sendError(res, "Failed to fetch products", 500);
  }
};

export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(id) } },

      // Lookup Company
      {
        $lookup: {
          from: "companies",
          localField: "company_id",
          foreignField: "_id",
          as: "company"
        }
      },
      { $unwind: { path: "$company", preserveNullAndEmptyArrays: true } },

      // Lookup Generic
      {
        $lookup: {
          from: "generics",
          localField: "generic_id",
          foreignField: "_id",
          as: "generic"
        }
      },
      { $unwind: { path: "$generic", preserveNullAndEmptyArrays: true } },

      // Lookup Product Type
      {
        $lookup: {
          from: "producttypes",
          localField: "product_type",
          foreignField: "_id",
          as: "product_type"
        }
      },
      { $unwind: { path: "$product_type", preserveNullAndEmptyArrays: true } },

      // Lookup Pack Size
      {
        $lookup: {
          from: "packsizes",
          localField: "pack_size_id",
          foreignField: "_id",
          as: "pack_size"
        }
      },
      { $unwind: { path: "$pack_size", preserveNullAndEmptyArrays: true } },

      // Lookup Batches
      {
        $lookup: {
          from: "batches",
          localField: "_id",
          foreignField: "product_id",
          as: "batches"
        }
      },

      // Lookup Purchase Order Items
      {
        $lookup: {
          from: "orderitems",
          localField: "_id",
          foreignField: "product_id",
          as: "purchaseItems",
          pipeline: [
            {
              $lookup: {
                from: "orders",
                localField: "order_id",
                foreignField: "_id",
                as: "order"
              }
            },
            { $unwind: "$order" },
            { $match: { "order.type": "purchase" } }
          ]
        }
      },

      // Lookup Sale Order Items
      {
        $lookup: {
          from: "orderitems",
          localField: "_id",
          foreignField: "product_id",
          as: "saleItems",
          pipeline: [
            {
              $lookup: {
                from: "orders",
                localField: "order_id",
                foreignField: "_id",
                as: "order"
              }
            },
            { $unwind: "$order" },
            { $match: { "order.type": "sale" } }
          ]
        }
      },

      // Add calculated fields
      {
        $addFields: {
          // Current stock from batches
          current_stock: {
            $sum: {
              $map: {
                input: "$batches",
                as: "batch",
                in: { $ifNull: ["$$batch.stock", 0] }
              }
            }
          },
          stock: { // Also add stock field for consistency
            $sum: {
              $map: {
                input: "$batches",
                as: "batch",
                in: { $ifNull: ["$$batch.stock", 0] }
              }
            }
          },
          // Total purchased units
          total_purchased: {
            $sum: {
              $map: {
                input: "$purchaseItems",
                as: "item",
                in: { $ifNull: ["$$item.units", 0] }
              }
            }
          },
          // Total sold units
          total_sold: {
            $sum: {
              $map: {
                input: "$saleItems",
                as: "item",
                in: { $ifNull: ["$$item.units", 0] }
              }
            }
          },
          // Remaining stock (purchased - sold)
          remaining_stock: {
            $subtract: [
              {
                $sum: {
                  $map: {
                    input: "$purchaseItems",
                    as: "item",
                    in: { $ifNull: ["$$item.units", 0] }
                  }
                }
              },
              {
                $sum: {
                  $map: {
                    input: "$saleItems",
                    as: "item",
                    in: { $ifNull: ["$$item.units", 0] }
                  }
                }
              }
            ]
          },
          // Calculated sale price with tax
          calculated_sale_price: {
            $add: [
              "$retail_price",
              { $multiply: ["$retail_price", { $divide: ["$sales_tax", 100] }] }
            ]
          },
          // Detailed batches information
          detailed_batches: {
            $map: {
              input: "$batches",
              as: "batch",
              in: {
                batch_number: "$$batch.batch_number",
                expiry_date: "$$batch.expiry_date",
                stock: "$$batch.stock",
                purchase_price: "$$batch.purchase_price",
                retail_price: "$$batch.retail_price",
                trade_price: "$$batch.trade_price",
                mrp: "$$batch.mrp"
              }
            }
          },
          // Compute last purchase info
          lastPurchaseTradePrice: {
            $let: {
              vars: {
                lastItem: { $arrayElemAt: [{ $sortArray: { input: "$purchaseItems", sortBy: { "order.createdAt": -1 } } }, 0] }
              },
              in: { $ifNull: ["$$lastItem.unit_price", 0] }
            }
          },
          lastPurchasePrice: {
            $let: {
              vars: {
                lastItem: { $arrayElemAt: [{ $sortArray: { input: "$purchaseItems", sortBy: { "order.createdAt": -1 } } }, 0] }
              },
              in: {
                $let: {
                  vars: {
                    units: { $ifNull: ["$$lastItem.units", 0] },
                    total: { $ifNull: ["$$lastItem.total", 0] }
                  },
                  in: {
                    $cond: [
                      { $gt: ["$$units", 0] },
                      { $round: [{ $divide: ["$$total", "$$units"] }, 2] },
                      0
                    ]
                  }
                }
              }
            }
          },
          lastPurchaseDiscountPercentage: {
            $let: {
              vars: {
                lastItem: { $arrayElemAt: [{ $sortArray: { input: "$purchaseItems", sortBy: { "order.createdAt": -1 } } }, 0] }
              },
              in: {
                $let: {
                  vars: {
                    totalBeforeDiscount: { $multiply: [{ $ifNull: ["$$lastItem.unit_price", 0] }, { $ifNull: ["$$lastItem.units", 0] }] }
                  },
                  in: {
                    $cond: [
                      { $gt: ["$$totalBeforeDiscount", 0] },
                      { $round: [{ $multiply: [{ $divide: [{ $ifNull: ["$$lastItem.discount", 0] }, "$$totalBeforeDiscount"] }, 100] }, 2] },
                      0
                    ]
                  }
                }
              }
            }
          }
        }
      },

      // Project only necessary fields
      {
        $project: {
          name: 1,
          item_code: 1,
          description: 1,
          company_id: 1,
          company: { name: 1, _id: 1 },
          generic_id: 1,
          generic: { name: 1, _id: 1 },
          product_type_id: 1,
          product_type: { name: 1, _id: 1 },
          pack_size_id: 1,
          pack_size: { name: 1, _id: 1 },
          carton_size: 1,
          quantity_alert: 1,
          barcode_symbology: 1,

          // Pricing fields
          retail_price: 1,
          trade_price: 1,
          trade_price_percentage: 1,
          wholesale_price: 1,
          wholesale_price_percentage: 1,
          federal_tax: 1,
          federal_tax_percentage: 1,
          gst: 1,
          gst_percentage: 1,
          sales_tax: 1,
          sales_tax_percentage: 1,

          // Stock information
          current_stock: 1,
          stock: 1,
          total_purchased: 1,
          total_sold: 1,
          remaining_stock: 1,
          calculated_sale_price: 1,

          // Batches
          batches: "$detailed_batches",

          // Last purchase info
          lastPurchasePrice: 1,
          lastPurchaseTradePrice: 1,
          lastPurchaseDiscountPercentage: 1,

          // Timestamps
          createdAt: 1,
          updatedAt: 1
        }
      }
    ]);

    if (!product || product.length === 0) {
      return sendError(res, "Product not found", 404);
    }

    return successResponse(res, "Product fetched successfully", {
      product: product[0]
    }, 200);
  } catch (error) {
    console.error("Get Product Error:", error);
    return sendError(res, "Failed to fetch product", 500);
  }
};

export const updateProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!product) return sendError(res, "Product not found", 404);
    return successResponse(res, "Product updated successfully", { product }, 200);
  } catch (error) {
    console.error("Update Product Error:", error);
    return sendError(res, "Failed to update product", 500);
  }
};


export const deleteProduct = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const productId = req.params.id;

    // 1. Find product
    const product = await Product.findById(productId).session(session);
    if (!product) {
      await session.abortTransaction();
      return sendError(res, "Product not found", 404);
    }

    // 2. Find related order items
    const orderItems = await OrderItem.find({ product_id: productId }).session(session);

    // 3. Group by order_id to adjust orders later
    const orderAdjustments = {};
    for (const item of orderItems) {
      if (!orderAdjustments[item.order_id]) {
        orderAdjustments[item.order_id] = [];
      }
      orderAdjustments[item.order_id].push(item);
    }

    // 4. Reverse supplier/customer balances
    for (const [orderId, items] of Object.entries(orderAdjustments)) {
      const order = await Order.findById(orderId).session(session);
      if (!order) continue;

      let totalAdjustment = 0;
      for (const item of items) {
        totalAdjustment += item.total;
      }

      if (order.type === "purchase") {
        // Reduce supplier pay
        await Supplier.findByIdAndUpdate(
          order.supplier_id,
          { $inc: { pay: -totalAdjustment } },
          { session }
        );
      } else if (order.type === "sale") {
        // Reduce customer (supplier in your naming)
        await Supplier.findByIdAndUpdate(
          order.supplier_id,
          { $inc: { receive: -totalAdjustment } },
          { session }
        );
      }
    }

    // 5. Delete order items for this product
    await OrderItem.deleteMany({ product_id: productId }).session(session);

    // 6. Delete orders that now have no items
    const affectedOrders = Object.keys(orderAdjustments);
    for (const orderId of affectedOrders) {
      const remainingItems = await OrderItem.find({ order_id: orderId }).session(session);
      if (remainingItems.length === 0) {
        await Order.findByIdAndDelete(orderId).session(session);
      }
    }

    // 7. Delete batches of this product
    await Batch.deleteMany({ product_id: productId }).session(session);

    // 8. Finally delete the product itself
    await Product.findByIdAndDelete(productId).session(session);

    await session.commitTransaction();
    return successResponse(res, "Product and related data deleted successfully", null, 200);

  } catch (error) {
    await session.abortTransaction();
    console.error("Delete Product Error:", error);
    return sendError(res, "Failed to delete product and related data", 500);
  } finally {
    session.endSession();
  }
};


export const getProductTransactions = async (req, res) => {
  const { product_id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(product_id)) {
    return sendError(res, "Invalid product ID", 400);
  }

  try {
    const product = await Product.findById(product_id);
    if (!product) {
      return sendError(res, "Product not found", 404);
    }

    // 🔹 Fetch ALL transactions using aggregation for better performance
    const allTransactions = await OrderItem.aggregate([
      { $match: { product_id: new mongoose.Types.ObjectId(product_id) } },

      // Lookup Order details
      {
        $lookup: {
          from: "orders",
          localField: "order_id",
          foreignField: "_id",
          as: "order"
        }
      },
      { $unwind: "$order" },

      // Exclude orders that were marked as skipped (do not show skipped invoices)
      { $match: { "order.status": { $ne: "skipped" } } },

      // Lookup Party (Supplier/Customer) details
      {
        $lookup: {
          from: "suppliers",
          let: { supplierId: "$order.supplier_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ["$_id", "$$supplierId"] },
                    {
                      $eq: [
                        "$_id",
                        {
                          $cond: [
                            { $eq: [{ $type: "$$supplierId" }, "string"] },
                            { $toObjectId: "$$supplierId" },
                            "$$supplierId"
                          ]
                        }
                      ]
                    }
                  ]
                }
              }
            }
          ],
          as: "party"
        }
      },
      { $unwind: { path: "$party", preserveNullAndEmptyArrays: true } },

      // Filter relevant order types
      {
        $match: {
          "order.type": {
            $in: ["purchase", "sale", "purchase_return", "sale_return"]
          }
        }
      },

      // Lookup Batch to get historical prices if needed
      {
        $lookup: {
          from: "batches",
          let: { prod_id: "$product_id", batch_num: "$batch" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$product_id", "$$prod_id"] },
                    { $eq: ["$batch_number", "$$batch_num"] }
                  ]
                }
              }
            }
          ],
          as: "batch_info"
        }
      },
      { $unwind: { path: "$batch_info", preserveNullAndEmptyArrays: true } },

      // Lookup Product to get master retail price as secondary fallback
      {
        $lookup: {
          from: "products",
          localField: "product_id",
          foreignField: "_id",
          as: "master_product"
        }
      },
      { $unwind: { path: "$master_product", preserveNullAndEmptyArrays: true } },

      // Project fields
      {
        $project: {
          order_id: "$order._id",
          invoice_number: "$order.invoice_number",
          purchase_number: "$order.purchase_number",
          party_name: "$party.company_name",
          units: 1,
          unit_price: 1,
          discount: 1,
          profit: 1,
          total: 1,
          batch: 1,
          expiry: 1,
          status: "$order.status",
          type: "$order.type",
          date: "$order.createdAt",
          paid_amount: "$order.paid_amount",
          due_amount: "$order.due_amount",
          net_value: "$order.net_value",
          note: "$order.note",
          due_date: "$order.due_date",
          item_created_at: "$createdAt",
          // Calculate historical prices based on type
          retail_price: {
            $ifNull: ["$batch_info.retail_price", { $ifNull: ["$master_product.retail_price", "$unit_price"] }]
          },
          trade_price: {
            $ifNull: ["$batch_info.trade_price", { $ifNull: ["$master_product.trade_price", "$unit_price"] }]
          },
          sales_tax: {
            $ifNull: ["$batch_info.sales_tax", { $ifNull: ["$master_product.sales_tax", 0] }]
          }
        }
      },

      // Sort by date (oldest first for running balance calculation)
      { $sort: { date: 1, item_created_at: 1 } }
    ]);

    console.log(allTransactions);

    // 🔹 Calculate running balance (stock ledger)
    let runningBalance = 0;
    const transactionsWithBalance = allTransactions.map((transaction, index) => {
      let stockIn = 0;
      let stockOut = 0;

      // Determine IN/OUT based on transaction type
      switch (transaction.type) {
        case "purchase":
          stockIn = transaction.units;
          runningBalance += transaction.units;
          break;
        case "sale":
          stockOut = transaction.units;
          runningBalance -= transaction.units;
          break;
        case "purchase_return":
          // Return to supplier = stock goes out
          stockOut = transaction.units;
          runningBalance -= transaction.units;
          break;
        case "sale_return":
          // Return from customer = stock comes in
          stockIn = transaction.units;
          runningBalance += transaction.units;
          break;
      }

      // Calculate discount percentage
      const units = transaction.units || 0;
      const unitPrice = transaction.unit_price || 0;
      const discount = transaction.discount || 0;
      const totalBeforeDiscount = unitPrice * units;
      const discountPercentage = totalBeforeDiscount > 0
        ? Number(((discount / totalBeforeDiscount) * 100).toFixed(2))
        : 0;

      return {
        transaction_no: index + 1,
        date: transaction.date,
        type: transaction.type,
        invoice_number: transaction.invoice_number || transaction.purchase_number || "N/A",
        party_name: transaction.party_name || "N/A",
        batch: transaction.batch,
        expiry: transaction.expiry,
        stock_in: stockIn,
        stock_out: stockOut,
        retail_price: transaction.retail_price,
        trade_price: transaction.trade_price,
        sales_tax: transaction.sales_tax,
        unit_price: transaction.unit_price,
        discount: transaction.discount || 0,
        discount_percentage: discountPercentage, // ← Added
        total_value: transaction.total,
        running_balance: runningBalance,
        status: transaction.status,
        profit: transaction.profit || 0,
        paid_amount: transaction.paid_amount,
        due_amount: transaction.due_amount,
        note: transaction.note || "",
        order_id: transaction.order_id
      };
    });

    // 🔹 Calculate summary statistics
    const summary = {
      total_transactions: allTransactions.length,
      total_stock_in: transactionsWithBalance.reduce((sum, t) => sum + t.stock_in, 0),
      total_stock_out: transactionsWithBalance.reduce((sum, t) => sum + t.stock_out, 0),
      current_balance: runningBalance,
      total_purchase_value: transactionsWithBalance
        .filter(t => t.type === "purchase")
        .reduce((sum, t) => sum + t.total_value, 0),
      total_sale_value: transactionsWithBalance
        .filter(t => t.type === "sale")
        .reduce((sum, t) => sum + t.total_value, 0),
      total_profit: transactionsWithBalance.reduce((sum, t) => sum + t.profit, 0),
      total_discount: transactionsWithBalance.reduce((sum, t) => sum + t.discount, 0), // ← Added
      purchases_count: transactionsWithBalance.filter(t => t.type === "purchase").length,
      sales_count: transactionsWithBalance.filter(t => t.type === "sale").length,
      returns_count: transactionsWithBalance.filter(t =>
        t.type === "purchase_return" || t.type === "sale_return"
      ).length
    };

    // 🔹 Group transactions by type for quick reference
    const groupedByType = {
      purchases: transactionsWithBalance.filter(t => t.type === "purchase"),
      sales: transactionsWithBalance.filter(t => t.type === "sale"),
      purchase_returns: transactionsWithBalance.filter(t => t.type === "purchase_return"),
      sale_returns: transactionsWithBalance.filter(t => t.type === "sale_return")
    };

    return successResponse(res, "Product transactions fetched successfully", {
      product: {
        _id: product._id,
        name: product.name,
        retail_price: product.retail_price,
        item_code: product.item_code
      },
      ledger: transactionsWithBalance, // All transactions with running balance
      summary,
      grouped_transactions: groupedByType
    });
  } catch (error) {
    console.error("Get Product Transactions Error:", error);
    return sendError(res, "Failed to fetch product transactions", 500);
  }
};




const productController = {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  getProductTransactions
};

export default productController;