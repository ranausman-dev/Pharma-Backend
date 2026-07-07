import { BulkCashRecovery } from "../models/bulkCashRecoveryModel.js";
import { SupplierModel as Supplier } from "../models/supplierModel.js";
import { User } from "../models/userModel.js";
import { sendError, successResponse } from "../utils/response.js";
import mongoose from "mongoose";

// Generate next CASH-XXXX id
const generateCashId = async () => {
  const last = await BulkCashRecovery.findOne({
    cash_id: { $regex: /^CASH-\d+$/ },
  })
    .sort({ createdAt: -1 })
    .select("cash_id");

  let nextNum = 1;
  if (last?.cash_id) {
    const num = parseInt(last.cash_id.replace("CASH-", ""), 10);
    if (!isNaN(num)) nextNum = num + 1;
  }
  return `CASH-${nextNum}`;
};

// ── CREATE ──────────────────────────────────────────────────────────────────

export const createBulkRecovery = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { customer_id, booker_id, amount, date, note } = req.body;

    if (!customer_id || !booker_id || !amount || amount <= 0) {
      await session.abortTransaction();
      return sendError(res, "Customer, booker, and a positive amount are required", 400);
    }

    // Validate customer exists
    const customer = await Supplier.findById(customer_id).session(session);
    if (!customer) {
      await session.abortTransaction();
      return sendError(res, "Customer not found", 404);
    }

    // Validate booker exists
    const booker = await User.findById(booker_id).session(session);
    if (!booker) {
      await session.abortTransaction();
      return sendError(res, "Booker (employee) not found", 404);
    }

    // Check amount does not exceed customer's current debit (pay balance)
    const customerDebit = (customer.pay || 0) - (customer.receive || 0);
    if (amount > customerDebit + 0.01) {
      await session.abortTransaction();
      return sendError(
        res,
        `Amount (${amount}) exceeds customer's outstanding debit (${customerDebit.toFixed(2)})`,
        400
      );
    }

    // Generate cash ID
    const cash_id = await generateCashId();

    // Create recovery record
    const [recovery] = await BulkCashRecovery.create(
      [{
        cash_id,
        customer_id,
        booker_id,
        amount: Number(amount),
        date: date || new Date(),
        note: note || "",
        status: "active",
      }],
      { session }
    );

    // Reduce customer debit (reduce pay, or increase receive if pay goes below 0)
    let newPay = (customer.pay || 0) - amount;
    let newReceive = customer.receive || 0;
    if (newPay < 0) {
      newReceive += Math.abs(newPay);
      newPay = 0;
    }

    await Supplier.findByIdAndUpdate(
      customer_id,
      { pay: Number(newPay.toFixed(2)), receive: Number(newReceive.toFixed(2)) },
      { session }
    );

    await session.commitTransaction();

    // Populate for response
    const populated = await BulkCashRecovery.findById(recovery._id)
      .populate("customer_id", "company_name city pay receive")
      .populate("booker_id", "name");

    return successResponse(res, "Bulk recovery created successfully", { recovery: populated }, 201);
  } catch (error) {
    await session.abortTransaction();
    console.error("Create bulk recovery error:", error);
    return sendError(res, error.message);
  } finally {
    session.endSession();
  }
};

// ── GET ALL (filterable by booker_id) ───────────────────────────────────────

export const getBulkRecoveries = async (req, res) => {
  try {
    const { booker_id } = req.query;
    const filter = { status: "active" };
    if (booker_id) filter.booker_id = booker_id;

    const recoveries = await BulkCashRecovery.find(filter)
      .populate("customer_id", "company_name city pay receive")
      .populate("booker_id", "name")
      .sort({ createdAt: -1 });

    return successResponse(res, "Bulk recoveries fetched", { recoveries });
  } catch (error) {
    console.error("Get bulk recoveries error:", error);
    return sendError(res, error.message);
  }
};

// ── EDIT (reverse old, apply new) ───────────────────────────────────────────

export const editBulkRecovery = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { customer_id, amount, note, date } = req.body;

    const recovery = await BulkCashRecovery.findById(id).session(session);
    if (!recovery || recovery.status !== "active") {
      await session.abortTransaction();
      return sendError(res, "Recovery not found or already reversed", 404);
    }

    // ── Step 1: Reverse the old entry ──
    const oldCustomer = await Supplier.findById(recovery.customer_id).session(session);
    if (oldCustomer) {
      // Add back the old amount to old customer's debit
      const restoredPay = (oldCustomer.pay || 0) + recovery.amount;
      const currentReceive = oldCustomer.receive || 0;
      let finalPay = restoredPay;
      let finalReceive = currentReceive;
      // Normalize: if receive > 0 and pay > 0, net them
      if (finalReceive > 0 && finalPay > 0) {
        if (finalPay >= finalReceive) {
          finalPay -= finalReceive;
          finalReceive = 0;
        } else {
          finalReceive -= finalPay;
          finalPay = 0;
        }
      }
      await Supplier.findByIdAndUpdate(
        recovery.customer_id,
        { pay: Number(finalPay.toFixed(2)), receive: Number(finalReceive.toFixed(2)) },
        { session }
      );
    }

    // ── Step 2: Validate and apply new entry ──
    const newCustomerId = customer_id || recovery.customer_id;
    const newAmount = amount !== undefined ? Number(amount) : recovery.amount;

    if (newAmount <= 0) {
      await session.abortTransaction();
      return sendError(res, "Amount must be positive", 400);
    }

    const newCustomer = await Supplier.findById(newCustomerId).session(session);
    if (!newCustomer) {
      await session.abortTransaction();
      return sendError(res, "New customer not found", 404);
    }

    const newDebit = (newCustomer.pay || 0) - (newCustomer.receive || 0);
    if (newAmount > newDebit + 0.01) {
      await session.abortTransaction();
      return sendError(
        res,
        `Amount (${newAmount}) exceeds new customer's outstanding debit (${newDebit.toFixed(2)})`,
        400
      );
    }

    // Reduce new customer's debit
    let newPay = (newCustomer.pay || 0) - newAmount;
    let newReceive = newCustomer.receive || 0;
    if (newPay < 0) {
      newReceive += Math.abs(newPay);
      newPay = 0;
    }
    await Supplier.findByIdAndUpdate(
      newCustomerId,
      { pay: Number(newPay.toFixed(2)), receive: Number(newReceive.toFixed(2)) },
      { session }
    );

    // ── Step 3: Update the recovery record ──
    recovery.customer_id = newCustomerId;
    recovery.amount = newAmount;
    if (note !== undefined) recovery.note = note;
    if (date) recovery.date = date;
    await recovery.save({ session });

    await session.commitTransaction();

    const populated = await BulkCashRecovery.findById(id)
      .populate("customer_id", "company_name city pay receive")
      .populate("booker_id", "name");

    return successResponse(res, "Recovery updated successfully", { recovery: populated });
  } catch (error) {
    await session.abortTransaction();
    console.error("Edit bulk recovery error:", error);
    return sendError(res, error.message);
  } finally {
    session.endSession();
  }
};

// ── DELETE (reverse and mark as reversed) ───────────────────────────────────

export const deleteBulkRecovery = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;

    const recovery = await BulkCashRecovery.findById(id).session(session);
    if (!recovery || recovery.status !== "active") {
      await session.abortTransaction();
      return sendError(res, "Recovery not found or already reversed", 404);
    }

    // Restore customer debit
    const customer = await Supplier.findById(recovery.customer_id).session(session);
    if (customer) {
      const restoredPay = (customer.pay || 0) + recovery.amount;
      const currentReceive = customer.receive || 0;
      let finalPay = restoredPay;
      let finalReceive = currentReceive;
      if (finalReceive > 0 && finalPay > 0) {
        if (finalPay >= finalReceive) {
          finalPay -= finalReceive;
          finalReceive = 0;
        } else {
          finalReceive -= finalPay;
          finalPay = 0;
        }
      }
      await Supplier.findByIdAndUpdate(
        recovery.customer_id,
        { pay: Number(finalPay.toFixed(2)), receive: Number(finalReceive.toFixed(2)) },
        { session }
      );
    }

    // Mark as reversed
    recovery.status = "reversed";
    await recovery.save({ session });

    await session.commitTransaction();
    return successResponse(res, "Recovery reversed and deleted successfully");
  } catch (error) {
    await session.abortTransaction();
    console.error("Delete bulk recovery error:", error);
    return sendError(res, error.message);
  } finally {
    session.endSession();
  }
};

export default {
  createBulkRecovery,
  getBulkRecoveries,
  editBulkRecovery,
  deleteBulkRecovery,
};
