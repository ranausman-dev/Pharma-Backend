import mongoose from "mongoose";
import { SupplierModel } from "../models/supplierModel.js";
import { SupplierLedger } from "../models/supplierLedgerModel.js";
import { sendError, successResponse } from "../utils/response.js";

export const getAllCustomers = async (req, res) => {
  try {
    const filter = {
      $or: [{ role: "customer" }, { role: "both" }],
    };

    // Fetch all customers
    const customers = await SupplierModel.find(filter)
      .populate("area_id", "name city description")
      .populate("booker_id", "name")
      .lean();

    const now = new Date();

    // Initialize totals
    let totals = {
      all: { debit: 0, credit: 0, debitCustomers: 0, creditCustomers: 0 },
      today: { debit: 0, credit: 0, debitCustomers: 0, creditCustomers: 0 },
      weekly: { debit: 0, credit: 0, debitCustomers: 0, creditCustomers: 0 },
      monthly: { debit: 0, credit: 0, debitCustomers: 0, creditCustomers: 0 },
      yearly: { debit: 0, credit: 0, debitCustomers: 0, creditCustomers: 0 },
    };

    // Track unique customers
    const clientTrackers = {
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

    // Process each customer
    customers.forEach((customer) => {
      // const debit = customer.pay || 0;      // customer owes us
      // const credit = customer.receive || 0; // we owe customer
      let debit = 0;
      let credit = 0;

      const pay = customer.pay || 0;
      const receive = customer.receive || 0;

      if (customer.role === "customer") {
        const balance = pay - receive;

        if (balance > 0) debit = balance;
        else if (balance < 0) credit = Math.abs(balance);
      }

      // If role is BOTH → only count CUSTOMER side
      if (customer.role === "both" && customer.balanceType === "receive") {
        const balance = pay - receive;

        if (balance > 0) debit = balance;
        else if (balance < 0) credit = Math.abs(balance);
      }
      const updatedAt = new Date(customer.updatedAt || customer.createdAt);

      // --- ALL ---
      if (debit > 0) {
        totals.all.debit += debit;
        clientTrackers.all.debit.add(customer._id.toString());
      }
      if (credit > 0) {
        totals.all.credit += credit;
        clientTrackers.all.credit.add(customer._id.toString());
      }

      // --- TODAY ---
      if (updatedAt >= todayStart && updatedAt <= todayEnd) {
        if (debit > 0) {
          totals.today.debit += debit;
          clientTrackers.today.debit.add(customer._id.toString());
        }
        if (credit > 0) {
          totals.today.credit += credit;
          clientTrackers.today.credit.add(customer._id.toString());
        }
      }

      // --- WEEKLY ---
      if (updatedAt >= weekStart && updatedAt <= weekEnd) {
        if (debit > 0) {
          totals.weekly.debit += debit;
          clientTrackers.weekly.debit.add(customer._id.toString());
        }
        if (credit > 0) {
          totals.weekly.credit += credit;
          clientTrackers.weekly.credit.add(customer._id.toString());
        }
      }

      // --- MONTHLY ---
      if (
        updatedAt.getFullYear() === now.getFullYear() &&
        updatedAt.getMonth() === now.getMonth()
      ) {
        if (debit > 0) {
          totals.monthly.debit += debit;
          clientTrackers.monthly.debit.add(customer._id.toString());
        }
        if (credit > 0) {
          totals.monthly.credit += credit;
          clientTrackers.monthly.credit.add(customer._id.toString());
        }
      }

      // --- YEARLY ---
      if (updatedAt.getFullYear() === now.getFullYear()) {
        if (debit > 0) {
          totals.yearly.debit += debit;
          clientTrackers.yearly.debit.add(customer._id.toString());
        }
        if (credit > 0) {
          totals.yearly.credit += credit;
          clientTrackers.yearly.credit.add(customer._id.toString());
        }
      }
    });

    // Set client counts
    Object.keys(totals).forEach((period) => {
      totals[period].debitCustomers = clientTrackers[period].debit.size;
      totals[period].creditCustomers = clientTrackers[period].credit.size;
    });

    return successResponse(res, "Customers fetched successfully", {
      customers,
      totals,
      totalItems: customers.length,
    });
  } catch (error) {
    console.error("Fetch Customers Error:", error);
    return sendError(res, "Failed to fetch customers", 500);
  }
};

export const getAllActiveCustomers = async (req, res) => {
  try {
    const filter = {
      $and: [
        { status: "active" },
        { $or: [{ role: "customer" }, { role: "both" }] },
      ],
    };

    // Fetch all matching customers
    const customers = await SupplierModel.find(filter)
      .populate("area_id", "name city description")
      .populate("booker_id", "name");

    // Total count of customers (optional, just for info)
    const totalCustomers = customers.length;

    return successResponse(res, "Customers fetched successfully", {
      customers,
      totalItems: totalCustomers,
    });
  } catch (error) {
    console.error("Fetch Customers Error:", error);
    return sendError(res, "Failed to fetch customers", 500);
  }
};

// Get all customers without pagination (for dropdowns etc.)
export const getCustomerList = async (req, res) => {
  try {
    const customers = await SupplierModel.find({
      $or: [{ role: "customer" }, { role: "both" }],
    }).populate("booker_id");

    return successResponse(res, "Customers fetched", { customers });
  } catch (error) {
    console.error("Get Customers Error:", error);
    return sendError(res, "Error fetching customers", 500);
  }
};

// Get single customer for edit
export const editCustomer = async (req, res) => {
  try {
    const customer = await SupplierModel.findById(req.params.id).populate(
      "area_id city_id booker_id",
    );

    if (!customer) return sendError(res, "Customer not found", 404);

    return successResponse(res, "Customer fetched", { customer });
  } catch (error) {
    console.error("Edit Customer Error:", error);
    return sendError(res, "Failed to fetch customer", 500);
  }
};

// Show customer with purchases (optional)
export const showCustomer = async (req, res) => {
  try {
    const customer = await SupplierModel.findById(req.params.id);
    //   .populate("booker_id");

    if (!customer) return sendError(res, "Customer not found", 404);

    // TODO: if you have a purchase/order model, populate or query them here

    return successResponse(res, "Customer detail", { customer });
  } catch (error) {
    console.error("Show Customer Error:", error);
    return sendError(res, "Failed to fetch customer details", 500);
  }
};

// Create new customer
export const createCustomer = async (req, res) => {
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
      status,
      licence_number,
      licence_expiry,
      ntn_number,
      role,
      balanceType,
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

    //Opening balance will directly become the receive amount
    const finalPay = balanceType === "pay" ? opening_balance : 0;
    const finalReceive = balanceType === "receive" ? opening_balance : 0;

    //Prepare supplier data
    const customerData = {
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
      receive: finalReceive,
      pay: finalPay,
      credit_period: credit_period || 0,
      credit_limit: credit_limit || 0,
      cnic: cnic || "",
      status: status || "active",
      licence_photo: licence_photo || "",
    };

    const customer = await SupplierModel.create(customerData);
    return successResponse(res, "Customer created", { customer }, 201);
  } catch (error) {
    console.error("Create Customer Error:", error);
    return sendError(res, "Failed to create customer", 500);
  }
};

// Update customer
export const updateCustomer = async (req, res) => {
  try {
    const updateData = { ...req.body };

    // Ensure area_id is stored as array of ObjectIds
    if (updateData.area_id) {
      updateData.area_id = Array.isArray(updateData.area_id)
        ? updateData.area_id.map((id) => new mongoose.Types.ObjectId(id))
        : [new mongoose.Types.ObjectId(updateData.area_id)];
    }

    if (req.file) {
      updateData.licence_photo = req.file.filename;
    }

    const updatedCustomer = await SupplierModel.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }, // Return updated document and run validators
    );

    if (!updatedCustomer) return sendError(res, "Customer not found", 404);

    return successResponse(res, "Customer updated successfully", {
      customer: updatedCustomer,
    });
  } catch (error) {
    console.error("Update Customer Error:", error.message);
    return sendError(res, "Failed to update customer", 500);
  }
};

// Delete customer
export const deleteCustomer = async (req, res) => {
  try {
    const customer = await SupplierModel.findById(req.params.id);
    if (!customer) return sendError(res, "Customer not found", 404);

    await customer.deleteOne();
    await SupplierLedger.deleteMany({ supplier_id: req.params.id });
    return successResponse(res, "Customer deleted successfully");
  } catch (error) {
    console.error("Delete Customer Error:", error);
    return sendError(res, "Failed to delete customer", 500);
  }
};

// Toggle status (active/inactive)
export const toggleCustomerStatus = async (req, res) => {
  try {
    const { id, status } = req.body;
    const customer = await SupplierModel.findById(id);
    if (!customer) return sendError(res, "Customer not found", 404);

    customer.status = status;
    await customer.save();

    return successResponse(res, "Status updated", { status });
  } catch (error) {
    console.error("Toggle Status Error:", error);
    return sendError(res, "Failed to update status", 500);
  }
};

// Search customers
export const searchCustomers = async (req, res) => {
  try {
    const { search } = req.query;

    const customers = await SupplierModel.find({
      $and: [
        {
          $or: [
            { name: new RegExp(search, "i") },
            { email: new RegExp(search, "i") },
          ],
        },
        {
          $or: [{ role: "customer" }, { role: "both" }],
        },
      ],
    })
      .limit(10)
      .populate("area_id");

    return successResponse(res, "Search results", { customers });
  } catch (error) {
    console.error("Search Customers Error:", error);
    return sendError(res, "Failed to search customers", 500);
  }
};

// Export all
const customerController = {
  getAllCustomers,
  getCustomerList,
  editCustomer,
  showCustomer,
  createCustomer,
  getAllActiveCustomers,
  updateCustomer,
  deleteCustomer,
  toggleCustomerStatus,
  searchCustomers,
};

export default customerController;
