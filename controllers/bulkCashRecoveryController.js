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
<<<<<<< HEAD
  // const session = await mongoose.startSession();
  // session.startTransaction();
=======
  const session = await mongoose.startSession();
  session.startTransaction();
>>>>>>> 54864e09bfb82fba45a6586c3ecb7b9f2ac0e4aa

  try {
    const { customer_id, booker_id, amount, date, note } = req.body;

    if (!customer_id || !booker_id || !amount || amount <= 0) {
<<<<<<< HEAD
      // await session.abortTransaction();
=======
      await session.abortTransaction();
>>>>>>> 54864e09bfb82fba45a6586c3ecb7b9f2ac0e4aa
      return sendError(res, "Customer, booker, and a positive amount are required", 400);
    }

    // Validate customer exists
<<<<<<< HEAD
    const customer = await Supplier.findById(customer_id);
    if (!customer) {
      // await session.abortTransaction();
=======
    const customer = await Supplier.findById(customer_id).session(session);
    if (!customer) {
      await session.abortTransaction();
>>>>>>> 54864e09bfb82fba45a6586c3ecb7b9f2ac0e4aa
      return sendError(res, "Customer not found", 404);
    }

    // Validate booker exists
<<<<<<< HEAD
    const booker = await User.findById(booker_id);
    if (!booker) {
      // await session.abortTransaction();
=======
    const booker = await User.findById(booker_id).session(session);
    if (!booker) {
      await session.abortTransaction();
>>>>>>> 54864e09bfb82fba45a6586c3ecb7b9f2ac0e4aa
      return sendError(res, "Booker (employee) not found", 404);
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
<<<<<<< HEAD
      
=======
      { session }
>>>>>>> 54864e09bfb82fba45a6586c3ecb7b9f2ac0e4aa
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
<<<<<<< HEAD
      
    );

    // await session.commitTransaction();
=======
      { session }
    );

    await session.commitTransaction();
>>>>>>> 54864e09bfb82fba45a6586c3ecb7b9f2ac0e4aa

    // Populate for response
    const populated = await BulkCashRecovery.findById(recovery._id)
      .populate({
        path: "customer_id",
        select: "company_name city pay receive area_id",
        populate: {
          path: "area_id",
          select: "name",
        },
      })
      .populate("booker_id", "name");

    return successResponse(res, "Bulk recovery created successfully", { recovery: populated }, 201);
  } catch (error) {
<<<<<<< HEAD
    // await session.abortTransaction();
    console.error("Create bulk recovery error:", error);
    return sendError(res, error.message);
  } finally {
    // session.endSession();
  }
};

export const createMultipleBulkRecoveries = async (req, res) => {
  // const session = await mongoose.startSession();
  // session.startTransaction();

  try {
    const { recoveries } = req.body;
    
    if (!Array.isArray(recoveries) || recoveries.length === 0) {
      // await session.abortTransaction();
      return sendError(res, "Recoveries array is required", 400);
    }

    try {
      await mongoose.connection.collection('bulkcashrecoveries').dropIndex('cash_id_1');
      console.log("Dropped cash_id_1 index successfully");
    } catch (err) {
      console.log("cash_id_1 index may not exist or could not be dropped:", err.message);
    }

    const cash_id = await generateCashId();
    const createdRecoveries = [];

    for (const rec of recoveries) {
      const { customer_id, booker_id, amount, date, note } = rec;

      if (!customer_id || !booker_id || !amount || amount <= 0) {
        continue; // Skip invalid entries
      }

      const customer = await Supplier.findById(customer_id);
      if (!customer) continue;

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
        
      );

      let newPay = (customer.pay || 0) - amount;
      let newReceive = customer.receive || 0;
      if (newPay < 0) {
        newReceive += Math.abs(newPay);
        newPay = 0;
      }

      await Supplier.findByIdAndUpdate(
        customer_id,
        { pay: Number(newPay.toFixed(2)), receive: Number(newReceive.toFixed(2)) },
        
      );

      createdRecoveries.push(recovery);
    }

    // await session.commitTransaction();
    return successResponse(res, "Bulk recoveries created successfully", { createdCount: createdRecoveries.length }, 201);
  } catch (error) {
    // await session.abortTransaction();
    console.error("Create multiple bulk recovery error:", error);
    return sendError(res, error.message);
  } finally {
    // session.endSession();
=======
    await session.abortTransaction();
    console.error("Create bulk recovery error:", error);
    return sendError(res, error.message);
  } finally {
    session.endSession();
>>>>>>> 54864e09bfb82fba45a6586c3ecb7b9f2ac0e4aa
  }
};

// ── GET ALL (filterable by booker_id) ───────────────────────────────────────

export const getBulkRecoveries = async (req, res) => {
  try {
    const { booker_id } = req.query;
    const filter = { status: "active" };
    if (booker_id) filter.booker_id = booker_id;

    const recoveries = await BulkCashRecovery.find(filter)
      .populate({
        path: "customer_id",
        select: "company_name city pay receive area_id",
        populate: {
          path: "area_id",
          select: "name",
        },
      })
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
<<<<<<< HEAD
  // const session = await mongoose.startSession();
  // session.startTransaction();
=======
  const session = await mongoose.startSession();
  session.startTransaction();
>>>>>>> 54864e09bfb82fba45a6586c3ecb7b9f2ac0e4aa

  try {
    const { id } = req.params;
    const { customer_id, amount, note, date } = req.body;

<<<<<<< HEAD
    const recovery = await BulkCashRecovery.findById(id);
    if (!recovery || recovery.status !== "active") {
      // await session.abortTransaction();
=======
    const recovery = await BulkCashRecovery.findById(id).session(session);
    if (!recovery || recovery.status !== "active") {
      await session.abortTransaction();
>>>>>>> 54864e09bfb82fba45a6586c3ecb7b9f2ac0e4aa
      return sendError(res, "Recovery not found or already reversed", 404);
    }

    // ── Step 1: Reverse the old entry ──
<<<<<<< HEAD
    const oldCustomer = await Supplier.findById(recovery.customer_id);
=======
    const oldCustomer = await Supplier.findById(recovery.customer_id).session(session);
>>>>>>> 54864e09bfb82fba45a6586c3ecb7b9f2ac0e4aa
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
<<<<<<< HEAD
        
=======
        { session }
>>>>>>> 54864e09bfb82fba45a6586c3ecb7b9f2ac0e4aa
      );
    }

    // ── Step 2: Validate and apply new entry ──
    const newCustomerId = customer_id || recovery.customer_id;
    const newAmount = amount !== undefined ? Number(amount) : recovery.amount;

    if (newAmount <= 0) {
<<<<<<< HEAD
      // await session.abortTransaction();
      return sendError(res, "Amount must be positive", 400);
    }

    const newCustomer = await Supplier.findById(newCustomerId);
    if (!newCustomer) {
      // await session.abortTransaction();
=======
      await session.abortTransaction();
      return sendError(res, "Amount must be positive", 400);
    }

    const newCustomer = await Supplier.findById(newCustomerId).session(session);
    if (!newCustomer) {
      await session.abortTransaction();
>>>>>>> 54864e09bfb82fba45a6586c3ecb7b9f2ac0e4aa
      return sendError(res, "New customer not found", 404);
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
<<<<<<< HEAD
      
=======
      { session }
>>>>>>> 54864e09bfb82fba45a6586c3ecb7b9f2ac0e4aa
    );

    // ── Step 3: Update the recovery record ──
    recovery.customer_id = newCustomerId;
    recovery.amount = newAmount;
    if (note !== undefined) recovery.note = note;
    if (date) recovery.date = date;
<<<<<<< HEAD
    await recovery.save();

    // await session.commitTransaction();
=======
    await recovery.save({ session });

    await session.commitTransaction();
>>>>>>> 54864e09bfb82fba45a6586c3ecb7b9f2ac0e4aa

    const populated = await BulkCashRecovery.findById(id)
      .populate({
        path: "customer_id",
        select: "company_name city pay receive area_id",
        populate: {
          path: "area_id",
          select: "name",
        },
      })
      .populate("booker_id", "name");

    return successResponse(res, "Recovery updated successfully", { recovery: populated });
  } catch (error) {
<<<<<<< HEAD
    // await session.abortTransaction();
    console.error("Edit bulk recovery error:", error);
    return sendError(res, error.message);
  } finally {
    // session.endSession();
=======
    await session.abortTransaction();
    console.error("Edit bulk recovery error:", error);
    return sendError(res, error.message);
  } finally {
    session.endSession();
>>>>>>> 54864e09bfb82fba45a6586c3ecb7b9f2ac0e4aa
  }
};

// ── DELETE (reverse and mark as reversed) ───────────────────────────────────

export const deleteBulkRecovery = async (req, res) => {
<<<<<<< HEAD
  // const session = await mongoose.startSession();
  // session.startTransaction();
=======
  const session = await mongoose.startSession();
  session.startTransaction();
>>>>>>> 54864e09bfb82fba45a6586c3ecb7b9f2ac0e4aa

  try {
    const { id } = req.params;

<<<<<<< HEAD
    const recovery = await BulkCashRecovery.findById(id);
    if (!recovery || recovery.status !== "active") {
      // await session.abortTransaction();
=======
    const recovery = await BulkCashRecovery.findById(id).session(session);
    if (!recovery || recovery.status !== "active") {
      await session.abortTransaction();
>>>>>>> 54864e09bfb82fba45a6586c3ecb7b9f2ac0e4aa
      return sendError(res, "Recovery not found or already reversed", 404);
    }

    // Restore customer debit
<<<<<<< HEAD
    const customer = await Supplier.findById(recovery.customer_id);
=======
    const customer = await Supplier.findById(recovery.customer_id).session(session);
>>>>>>> 54864e09bfb82fba45a6586c3ecb7b9f2ac0e4aa
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
<<<<<<< HEAD
        
=======
        { session }
>>>>>>> 54864e09bfb82fba45a6586c3ecb7b9f2ac0e4aa
      );
    }

    // Mark as reversed
    recovery.status = "reversed";
<<<<<<< HEAD
    await recovery.save();

    // await session.commitTransaction();
    return successResponse(res, "Recovery reversed and deleted successfully");
  } catch (error) {
    // await session.abortTransaction();
    console.error("Delete bulk recovery error:", error);
    return sendError(res, error.message);
  } finally {
    // session.endSession();
=======
    await recovery.save({ session });

    await session.commitTransaction();
    return successResponse(res, "Recovery reversed and deleted successfully");
  } catch (error) {
    await session.abortTransaction();
    console.error("Delete bulk recovery error:", error);
    return sendError(res, error.message);
  } finally {
    session.endSession();
>>>>>>> 54864e09bfb82fba45a6586c3ecb7b9f2ac0e4aa
  }
};

export default {
  createBulkRecovery,
<<<<<<< HEAD
  createMultipleBulkRecoveries,
=======
>>>>>>> 54864e09bfb82fba45a6586c3ecb7b9f2ac0e4aa
  getBulkRecoveries,
  editBulkRecovery,
  deleteBulkRecovery,
};
