import { SupplierModel } from "../models/supplierModel.js";
import { OrderModel } from "../models/orderModel.js";
import { sendError, successResponse } from "../utils/response.js";

export const getAllSuppliers = async (req, res) => {
  try {
    const filter = {
      $or: [{ role: "supplier" }, { role: "both" }],
    };

    // Get all suppliers
    const suppliers = await SupplierModel.find(filter)
      .populate("area_id", "name city description")
      .lean();

    const now = new Date();

    // Initialize totals
    let totals = {
      all: { debit: 0, credit: 0, debitSuppliers: 0, creditSuppliers: 0 },
      today: { debit: 0, credit: 0, debitSuppliers: 0, creditSuppliers: 0 },
      weekly: { debit: 0, credit: 0, debitSuppliers: 0, creditSuppliers: 0 },
      monthly: { debit: 0, credit: 0, debitSuppliers: 0, creditSuppliers: 0 },
      yearly: { debit: 0, credit: 0, debitSuppliers: 0, creditSuppliers: 0 },
    };

    // Track unique suppliers
    const supplierTrackers = {
      all: { debit: new Set(), credit: new Set() },
      today: { debit: new Set(), credit: new Set() },
      weekly: { debit: new Set(), credit: new Set() },
      monthly: { debit: new Set(), credit: new Set() },
      yearly: { debit: new Set(), credit: new Set() },
    };

    // Weekly range
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // Today range
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    suppliers.forEach((supplier) => {
      // const debit = supplier.pay || 0;     // we pay supplier
      // const credit = supplier.receive || 0; // supplier pays us
      let debit = 0;
      let credit = 0;

      const pay = supplier.pay || 0;
      const receive = supplier.receive || 0;

      if (supplier.role === "supplier") {
        const balance = pay - receive;

        if (balance > 0) debit = balance;
        else if (balance < 0) credit = Math.abs(balance);
      }

      // If role is BOTH → only count SUPPLIER side
      if (supplier.role === "both" && supplier.balanceType === "pay") {
        const balance = pay - receive;

        if (balance > 0) debit = balance;
        else if (balance < 0) credit = Math.abs(balance);
      }
      const updatedAt = new Date(supplier.updatedAt || supplier.createdAt);

      // --- ALL ---
      if (debit > 0) {
        totals.all.debit += debit;
        supplierTrackers.all.debit.add(supplier._id.toString());
      }
      if (credit > 0) {
        totals.all.credit += credit;
        supplierTrackers.all.credit.add(supplier._id.toString());
      }

      // --- TODAY ---
      if (updatedAt >= todayStart && updatedAt <= todayEnd) {
        if (debit > 0) {
          totals.today.debit += debit;
          supplierTrackers.today.debit.add(supplier._id.toString());
        }
        if (credit > 0) {
          totals.today.credit += credit;
          supplierTrackers.today.credit.add(supplier._id.toString());
        }
      }

      // --- WEEKLY ---
      if (updatedAt >= weekStart && updatedAt <= weekEnd) {
        if (debit > 0) {
          totals.weekly.debit += debit;
          supplierTrackers.weekly.debit.add(supplier._id.toString());
        }
        if (credit > 0) {
          totals.weekly.credit += credit;
          supplierTrackers.weekly.credit.add(supplier._id.toString());
        }
      }

      // --- MONTHLY ---
      if (
        updatedAt.getFullYear() === now.getFullYear() &&
        updatedAt.getMonth() === now.getMonth()
      ) {
        if (debit > 0) {
          totals.monthly.debit += debit;
          supplierTrackers.monthly.debit.add(supplier._id.toString());
        }
        if (credit > 0) {
          totals.monthly.credit += credit;
          supplierTrackers.monthly.credit.add(supplier._id.toString());
        }
      }

      // --- YEARLY ---
      if (updatedAt.getFullYear() === now.getFullYear()) {
        if (debit > 0) {
          totals.yearly.debit += debit;
          supplierTrackers.yearly.debit.add(supplier._id.toString());
        }
        if (credit > 0) {
          totals.yearly.credit += credit;
          supplierTrackers.yearly.credit.add(supplier._id.toString());
        }
      }
    });

    // Set counts
    Object.keys(totals).forEach((period) => {
      totals[period].debitSuppliers = supplierTrackers[period].debit.size;
      totals[period].creditSuppliers = supplierTrackers[period].credit.size;
    });

    return successResponse(res, "Suppliers fetched successfully", {
      suppliers,
      totals,
      totalItems: suppliers.length,
    });
  } catch (error) {
    console.error("Fetch Suppliers Error:", error);
    return sendError(res, "Failed to fetch suppliers", 500);
  }
};

export const getAllActiveSuppliers = async (req, res) => {
  try {
    const filter = {
      status: "active",
      $or: [{ role: "supplier" }, { role: "both" }],
    };

    // Get all suppliers ()
    const suppliers = await SupplierModel.find(filter).populate(
      "area_id",
      "name city description",
    );

    const totalSuppliers = suppliers.length;

    return successResponse(res, "Suppliers fetched successfully", {
      suppliers,
      totalItems: totalSuppliers,
    });
  } catch (error) {
    console.error("Fetch Suppliers Error:", error);
    return sendError(res, "Failed to fetch suppliers", 500);
  }
};

export const getAllActiveSuppliersAndCustomers = async (req, res) => {
  try {
    const filter = {
      status: "active",
      $or: [{ role: "supplier" }, { role: "customer" }, { role: "both" }],
    };

    // Fetch all active suppliers, customers, and both
    const data = await SupplierModel.find(filter)
      .populate("area_id", "name city description")
      .populate("booker_id", "name");

    return successResponse(
      res,
      "Suppliers and Customers fetched successfully",
      {
        data,
        totalItems: data.length,
      },
    );
  } catch (error) {
    console.error("Fetch Suppliers/Customers Error:", error);
    return sendError(res, "Failed to fetch suppliers and customers", 500);
  }
};

export const getSupplierById = async (req, res) => {
  try {
    const supplier = await SupplierModel.findById(req.params.id).populate(
      "area_id",
      "name",
    );
    if (!supplier) return sendError(res, "Supplier not found", 404);
    return successResponse(res, "Supplier fetched", { supplier });
  } catch (error) {
    console.error("Get Supplier Error:", error);
    return sendError(res, "Error fetching supplier", 500);
  }
};

export const createSupplier = async (req, res) => {
  try {
    const {
      owner1_name,
      owner2_name,
      owner1_phone_number,
      owner2_phone_number,
      email,
      phone_number,
      company_name,
      ptcl_number,
      address,
      area_id,
      city,
      licence_number,
      licence_expiry,
      ntn_number,
      role,
      opening_balance,
      credit_period,
      credit_limit,
      cnic,
      booker_id,
      licence_photo,
    } = req.body || {};

    if (!company_name || !city || !role) {
      return sendError(res, "Company Name, City and Role is required.");
    }

    // 📦 Prepare supplier data
    const supplierData = {
      owner1_name,
      owner2_name: owner2_name || "",
      owner1_phone_number: owner1_phone_number || "",
      owner2_phone_number: owner2_phone_number || "",
      email: email || "",
      phone_number: phone_number || "",
      company_name: company_name || "",
      ptcl_number: ptcl_number || "",
      address: address || "",
      area_id,
      city,
      booker_id: booker_id || null,
      licence_number: licence_number || "",
      licence_expiry: licence_expiry || "",
      ntn_number: ntn_number || "",
      role: role || "supplier",
      opening_balance: opening_balance || 0,
      credit_period: credit_period || 0,
      credit_limit: credit_limit || 0,
      cnic: cnic || "",
      status: "active",
      licence_photo: licence_photo || "",
    };

    const supplier = new SupplierModel(supplierData);
    await supplier.save();

    return successResponse(res, "Supplier created successfully", { supplier });
  } catch (error) {
    sendError(res, "Create Supplier Error", error);
  }
};

export const updateSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const supplier = await SupplierModel.findById(id);
    if (!supplier) return sendError(res, "Supplier not found", 404);

    const input = {
      ...req.body,
      licence_photo: req.body.licence_photo || "", // Expected from frontend if updated
    };

    await supplier.updateOne(input);
    return successResponse(res, "Supplier updated successfully", { supplier });
  } catch (error) {
    console.error("Update Supplier Error:", error);
    return sendError(res, "Failed to update supplier", 500);
  }
};

export const deleteSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const supplier = await SupplierModel.findById(id);
    if (!supplier) return sendError(res, "Supplier not found", 404);

    await supplier.deleteOne();
    return successResponse(res, "Supplier deleted successfully");
  } catch (error) {
    console.error("Delete Supplier Error:", error);
    return sendError(res, "Failed to delete supplier", 500);
  }
};

export const toggleSupplierStatus = async (req, res) => {
  try {
    const { id, status } = req.body;

    const supplier = await SupplierModel.findById(id);
    if (!supplier) return sendError(res, "Supplier not found", 404);

    supplier.status = status;
    await supplier.save();

    return successResponse(res, "Status updated successfully", { status });
  } catch (error) {
    console.error("Toggle Status Error:", error);
    return sendError(res, "Failed to update status", 500);
  }
};

export const searchSuppliers = async (req, res) => {
  try {
    const { search } = req.query;

    const suppliers = await SupplierModel.find({
      $and: [
        {
          $or: [
            { name: new RegExp(search, "i") },
            { email: new RegExp(search, "i") },
          ],
        },
        {
          $or: [{ role: "supplier" }, { role: "both" }],
        },
      ],
    })
      .limit(10)
      .populate("area_id");

    return successResponse(res, "Search results", { suppliers });
  } catch (error) {
    console.error("Search Suppliers Error:", error);
    return sendError(res, "Failed to search suppliers", 500);
  }
};

export const addSupplierBalance = async (req, res) => {
  try {
    const { supplierId, balanceType, amount } = req.body;

    if (!supplierId || !balanceType || typeof amount !== "number") {
      return sendError(
        res,
        "supplierId, balanceType, and amount are required",
        400,
      );
    }

    const supplier = await SupplierModel.findById(supplierId);
    if (!supplier) return sendError(res, "Supplier not found", 404);

    if (balanceType === "pay") {
      if (supplier.receive > 0) {
        if (amount >= supplier.receive) {
          // Cancel receive fully, leftover goes to pay
          supplier.pay += amount - supplier.receive;
          supplier.receive = 0;
        } else {
          // Reduce receive only
          supplier.receive -= amount;
        }
      } else {
        supplier.pay += amount;
      }
    } else if (balanceType === "receive") {
      if (supplier.pay > 0) {
        if (amount >= supplier.pay) {
          // Cancel pay fully, leftover goes to receive
          supplier.receive += amount - supplier.pay;
          supplier.pay = 0;
        } else {
          // Reduce pay only
          supplier.pay -= amount;
        }
      } else {
        supplier.receive += amount;
      }
    } else {
      return sendError(
        res,
        "balanceType must be either 'pay' or 'receive'",
        400,
      );
    }

    await supplier.save();

    return successResponse(res, "Balance updated successfully", { supplier });
  } catch (error) {
    console.error("Add Supplier Balance Error:", error);
    return sendError(res, "Failed to update supplier balance", 500);
  }
};

export const getSupplierLedger = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate, ledgerType } = req.query;

    const party = await SupplierModel.findById(id).populate("area_id", "name");
    if (!party) return sendError(res, "Party not found", 404);

    // Fetch all completed/recovered/returned orders
    const orderQuery = {
      supplier_id: id,
      type: { $in: ["purchase", "sale", "purchase_return", "sale_return"] },
      status: { $in: ["completed", "returned", "recovered"] },
    };

    const orders = await OrderModel.find(orderQuery)
      .sort({ createdAt: 1 })
      .lean();

    let ledger = [];

    // 1. Opening Balance entry
    const openingDate = party.createdAt || new Date(0);
    if (party.opening_balance && party.opening_balance > 0) {
      ledger.push({
        _id: `opening_${party._id}`,
        date: openingDate,
        description: "Opening Balance",
        debit: party.balanceType === "pay" ? party.opening_balance : 0,
        credit: party.balanceType === "receive" ? party.opening_balance : 0,
        isOpening: true,
      });
    }

    // 2. Generate ledger entries from orders
    orders.forEach((order) => {
      const date = order.createdAt;

      if (order.type === "sale") {
        // Sale Invoice
        ledger.push({
          _id: `${order._id}_sale`,
          order_id: order._id,
          date,
          description: `Sale Invoice (Invoice #: ${order.invoice_number})`,
          debit: order.total || 0,
          credit: 0,
          type: order.type,
        });

        // Initial Payment
        if (order.paid_amount && order.paid_amount > 0) {
          ledger.push({
            _id: `${order._id}_payment`,
            order_id: order._id,
            date,
            description: `Payment Received (Invoice #: ${order.invoice_number})`,
            debit: 0,
            credit: order.paid_amount,
            type: order.type,
          });
        }

        // Subsequent Recoveries
        if (order.recovered_amount && order.recovered_amount > 0) {
          ledger.push({
            _id: `${order._id}_recovery`,
            order_id: order._id,
            date: order.recovered_date || order.updatedAt || date,
            description: `Recovery Payment (Invoice #: ${order.invoice_number})`,
            debit: 0,
            credit: order.recovered_amount,
            type: order.type,
          });
        }
      } else if (order.type === "purchase") {
        // Purchase Invoice
        ledger.push({
          _id: `${order._id}_purchase`,
          order_id: order._id,
          date,
          description: `Purchase Invoice (Purchase #: ${order.purchase_number || order.invoice_number})`,
          debit: 0,
          credit: order.total || 0,
          type: order.type,
        });

        // Initial Payment
        if (order.paid_amount && order.paid_amount > 0) {
          ledger.push({
            _id: `${order._id}_payment`,
            order_id: order._id,
            date,
            description: `Payment Paid (Purchase #: ${order.purchase_number || order.invoice_number})`,
            debit: order.paid_amount,
            credit: 0,
            type: order.type,
          });
        }
      } else if (order.type === "sale_return") {
        ledger.push({
          _id: `${order._id}_return`,
          order_id: order._id,
          date,
          description: `Sale Return (Invoice #: ${order.invoice_number})`,
          debit: 0,
          credit: order.total || 0,
          type: order.type,
        });
      } else if (order.type === "purchase_return") {
        ledger.push({
          _id: `${order._id}_return`,
          order_id: order._id,
          date,
          description: `Purchase Return (Invoice #: ${order.invoice_number})`,
          debit: order.total || 0,
          credit: 0,
          type: order.type,
        });
      }
    });

    // Sort entries chronologically
    ledger.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Determine perspective
    const typeOfLedger = ledgerType || (party.role === "customer" ? "customer" : "supplier");

    // Compute running balance
    let runningBalance = 0;
    ledger = ledger.map((entry) => {
      const dr = entry.debit || 0;
      const cr = entry.credit || 0;

      if (typeOfLedger === "customer") {
        runningBalance += (dr - cr);
      } else {
        runningBalance += (cr - dr);
      }

      return {
        ...entry,
        runningBalance,
      };
    });

    // Apply date range
    let finalLedger = [];
    let openingBalanceForPeriod = 0;

    if (startDate) {
      const start = new Date(startDate);
      const preEntries = ledger.filter((e) => new Date(e.date) < start);
      if (preEntries.length > 0) {
        openingBalanceForPeriod = preEntries[preEntries.length - 1].runningBalance;
      }

      const rangeEntries = ledger.filter((e) => {
        const d = new Date(e.date);
        if (d < start) return false;
        if (endDate && d > new Date(endDate)) return false;
        return true;
      });

      finalLedger.push({
        _id: "carried_forward",
        date: start,
        description: "Balance Carried Forward",
        debit: 0,
        credit: 0,
        runningBalance: openingBalanceForPeriod,
        isCarriedForward: true,
      });

      finalLedger = [...finalLedger, ...rangeEntries];
    } else {
      if (endDate) {
        finalLedger = ledger.filter((e) => new Date(e.date) <= new Date(endDate));
      } else {
        finalLedger = ledger;
      }
    }

    return successResponse(res, "Ledger fetched successfully", {
      party,
      ledger: finalLedger,
      ledgerType: typeOfLedger,
    });
  } catch (error) {
    console.error("Ledger Fetch Error:", error);
    return sendError(res, "Failed to fetch ledger", 500);
  }
};

const supplierController = {
  getAllSuppliers,
  getSupplierById,
  getAllActiveSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  searchSuppliers,
  toggleSupplierStatus,
  addSupplierBalance,
  getAllActiveSuppliersAndCustomers,
  getSupplierLedger,
};

export default supplierController;
