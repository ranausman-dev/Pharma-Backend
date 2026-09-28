import Investor from "../models/investorModel.js";
import investorProfit from "../models/investorProfit.js";
import { OrderModel as Order } from "../models/orderModel.js";
import { sendError, successResponse } from "../utils/response.js";
<<<<<<< HEAD
import mongoose from "mongoose";

// Helper: transactions only work on replica sets or mongos
const isReplicaSet = () => Boolean(mongoose.connection?.client?.topology?.description?.setName);
=======
>>>>>>> 54864e09bfb82fba45a6586c3ecb7b9f2ac0e4aa

// 🔹 Helper: check if investor is eligible for profit in a given month
const checkEligibility = (joinDate, month) => {
  const join = new Date(joinDate);
  const calcMonth = new Date(`${month}-01`); // Example "2025-09-01"

  // Joined after this month → not eligible
  if (join > new Date(calcMonth.getFullYear(), calcMonth.getMonth() + 1, 0)) {
    return false;
  }

  // Joined in previous month → full eligible
  if (join < calcMonth) return "full";

  // Joined in the same month
  if (
    join.getMonth() === calcMonth.getMonth() &&
    join.getFullYear() === calcMonth.getFullYear()
  ) {
    if (join.getDate() === 1) return "full"; // from start
    if (join.getDate() > 1 && join.getDate() < 15) return "half"; // from 15th
    if (join.getDate() >= 15) return false; // next month
  }

  return false;
};

// 🔹 Add Investor
const addInvestor = async (req, res) => {
<<<<<<< HEAD
  let session = null;
  let useTransaction = false;

  if (isReplicaSet()) {
    try {
      session = await Investor.startSession();
      session.startTransaction();
      useTransaction = true;
    } catch (sessErr) {
      console.warn("MongoDB transaction not supported, running without transaction:", sessErr.message);
      session = null;
    }
  }
=======
  const session = await Investor.startSession();
  session.startTransaction();
>>>>>>> 54864e09bfb82fba45a6586c3ecb7b9f2ac0e4aa

  try {
    const {
      name,
      mobile_number,
      father_name,
      address,
      amount,
      profit_percentage,
      join_date,
      type,
      cnic_number,
      cnic_front_photo,
      cnic_back_photo,
      stam_photo,
      check_photo,
      description
    } = req.body;

    // Validate required fields
    if (!name || !amount || !join_date || !type) {
<<<<<<< HEAD
      if (useTransaction && session) {
        await session.abortTransaction();
        session.endSession();
      }
=======
>>>>>>> 54864e09bfb82fba45a6586c3ecb7b9f2ac0e4aa
      return sendError(res, "Name, amount, join date and type are required", 400);
    }

    // Validate type
    if (!["company", "investor"].includes(type)) {
<<<<<<< HEAD
      if (useTransaction && session) {
        await session.abortTransaction();
        session.endSession();
      }
=======
>>>>>>> 54864e09bfb82fba45a6586c3ecb7b9f2ac0e4aa
      return sendError(res, "Invalid type. Must be 'company' or 'investor'", 400);
    }

    // Check duplicate
    const existingInvestor = await Investor.findOne({ name });
    if (existingInvestor) {
<<<<<<< HEAD
      if (useTransaction && session) {
        await session.abortTransaction();
        session.endSession();
      }
=======
>>>>>>> 54864e09bfb82fba45a6586c3ecb7b9f2ac0e4aa
      return sendError(res, "Investor with this name already exists", 400);
    }

    // 1. Create new investor
<<<<<<< HEAD
    const investorData = {
=======
    const investor = await Investor.create([{
>>>>>>> 54864e09bfb82fba45a6586c3ecb7b9f2ac0e4aa
      name,
      father_name,
      mobile_number,
      address,
      profit_percentage: profit_percentage || null,
      join_date,
      type,
      cnic_number: cnic_number || null,
      cnic_front_photo: cnic_front_photo || null,
      cnic_back_photo: cnic_back_photo || null,
      stam_photo: stam_photo || null,
      check_photo: check_photo || null,
      amount_invested: [{
        amount,
        date: join_date || new Date(),
        description: description || "Opening Investment"
      }],
<<<<<<< HEAD
    };

    const investor = session
      ? await Investor.create([investorData], { session })
      : await Investor.create([investorData]);

    // 2. Get all active investors (including company)
    const investors = session
      ? await Investor.find({ status: "active" }).session(session)
      : await Investor.find({ status: "active" });
=======
    }], { session });

    // 2. Get all active investors (including company)
    const investors = await Investor.find({ status: "active" }).session(session);
>>>>>>> 54864e09bfb82fba45a6586c3ecb7b9f2ac0e4aa

    // 3. Calculate total capital
    const totalCapital = investors.reduce((sum, inv) => {
      const invested = inv.amount_invested.reduce((s, i) => s + i.amount, 0);
      return sum + invested;
    }, 0);

    // 4. Update shares for each investor
    for (const inv of investors) {
      const invested = inv.amount_invested.reduce((s, i) => s + i.amount, 0);
      inv.shares = totalCapital > 0 ? (invested / totalCapital) * 100 : 0;
<<<<<<< HEAD
      if (session) {
        await inv.save({ session });
      } else {
        await inv.save();
      }
    }

    if (useTransaction && session) {
      await session.commitTransaction();
      session.endSession();
    }

    return successResponse(res, "Investor added successfully and shares recalculated", { investor: investor[0] });
  } catch (error) {
    if (useTransaction && session) {
      try {
        if (session.inTransaction()) {
          await session.abortTransaction();
        }
      } catch (e) {}
      session.endSession();
    }
=======
      await inv.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    return successResponse(res, "Investor added successfully and shares recalculated", { investor: investor[0] });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
>>>>>>> 54864e09bfb82fba45a6586c3ecb7b9f2ac0e4aa
    console.error("Add investor error:", error);
    return sendError(res, error.message);
  }
};



// 🔹 Add New Investment For existing investor
const addInvestment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, date, description } = req.body;

    if (!amount || isNaN(amount)) {
      return res.status(400).json({ success: false, message: "Amount is required and must be a number" });
    }

    const investor = await Investor.findById(id);
    if (!investor) return res.status(404).json({ success: false, message: "Investor not found" });

    // Ensure amount_invested is an array
    if (!Array.isArray(investor.amount_invested)) {
      investor.amount_invested = [];
    }

    // Push new investment
    investor.amount_invested.push({
      amount: Number(amount),
      date: date ? new Date(date) : new Date(),
      description: description || ""
    });

    await investor.save();

    return successResponse(res, "Investment added successfully", { investor });
  } catch (error) {
    return sendError(res, error.message);
  }
};



export const getInvestors = async (req, res) => {
  try {
    const investors = await Investor.find().sort({ createdAt: -1 }).lean();

    let totalInvestment = 0;
    let totalGrossProfit = 0;
    let totalNetProfit = 0;
    let totalCredit = 0;
    let totalDebit = 0;

    const investorDetails = await Promise.all(
      investors.map(async (inv) => {
        // Safely sum all invested amounts
        const totalInvested = Array.isArray(inv.amount_invested)
          ? inv.amount_invested.reduce((sum, item) => sum + (item.amount || 0), 0)
          : 0;

        totalInvestment += totalInvested;

        // Get all profit records for this investor
        const profits = await investorProfit.find({ investor_id: inv._id }).lean();

        // Attach invoice_number from linked orders
        const profitsWithInvoice = await Promise.all(
          profits.map(async (p) => {
            let invoice_number = null;
            if (p.order_id) {
              const order = await Order.findById(p.order_id)
                .select("invoice_number")
                .lean();
              invoice_number = order?.invoice_number || null;
            }
            return { ...p, invoice_number };
          })
        );

        let grossProfitSum = 0;
        let netProfitSum = 0;

        profitsWithInvoice.forEach((p) => {
          grossProfitSum += p.gross_profit || 0;
          netProfitSum += p.net_profit || 0;
        });

        totalGrossProfit += grossProfitSum;
        totalNetProfit += netProfitSum;
        totalCredit += inv.credit || 0;
        totalDebit += inv.debit || 0;

        return {
          id: inv._id,
          name: inv.name,
          amount_invested: inv.amount_invested,
          total_invested: totalInvested,
          profit_percentage: inv.profit_percentage,
          join_date: inv.join_date,
          status: inv.status,
          type: inv.type,
          shares: inv.shares,

          // 💰 balances
          debit: inv.debit || 0,
          credit: inv.credit || 0,
          net_balance: (inv.credit || 0) - (inv.debit || 0),

          totalGrossProfit: grossProfitSum,
          totalNetProfit: netProfitSum,
          profits: profitsWithInvoice,
        };
      })
    );

    return successResponse(res, "Investors retrieved successfully", {
      investors: investorDetails,
      summary: {
        totalInvestment,
        totalGrossProfit,
        totalNetProfit,
        totalCredit,
        totalDebit,
        netBalance: totalCredit - totalDebit,
      },
    });
  } catch (error) {
    return sendError(res, error.message);
  }
};


export const updateInvestment = async (req, res) => {
  try {
    const { investorId, investmentId } = req.params;
    const { amount, date, description } = req.body;

    // Validate amount
    if (amount !== undefined && amount <= 0) {
      return sendError(res, "Amount must be a positive number", 400);
    }

    const investor = await Investor.findById(investorId);
    if (!investor) return sendError(res, "Investor not found", 404);

    // Find the specific investment in the array
    const investment = investor.amount_invested.id(investmentId);
    if (!investment) return sendError(res, "Investment not found", 404);

    // Update fields if provided
    if (amount !== undefined) investment.amount = amount;
    if (date) investment.date = new Date(date);
    if (description !== undefined) investment.description = description;

    // Save the investor
    await investor.save();

    return successResponse(res, "Investment updated successfully", { investor });
  } catch (error) {
    return sendError(res, error.message);
  }
};



// 🔹 Edit Investor
const editInvestor = async (req, res) => {
<<<<<<< HEAD
  let session = null;
  let useTransaction = false;

  if (isReplicaSet()) {
    try {
      session = await Investor.startSession();
      session.startTransaction();
      useTransaction = true;
    } catch (sessErr) {
      console.warn("MongoDB transaction not supported, running without transaction:", sessErr.message);
      session = null;
    }
  }
=======
  const session = await Investor.startSession();
  session.startTransaction();
>>>>>>> 54864e09bfb82fba45a6586c3ecb7b9f2ac0e4aa

  try {
    const { id } = req.params;
    const {
      name, profit_percentage, join_date, amount,
      father_name, mobile_number, address,
      cnic_number, cnic_front_photo, cnic_back_photo,
      stam_photo, check_photo
    } = req.body;

<<<<<<< HEAD
    const investor = session
      ? await Investor.findById(id).session(session)
      : await Investor.findById(id);

    if (!investor) {
      if (useTransaction && session) {
        await session.abortTransaction();
      }
=======
    const investor = await Investor.findById(id).session(session);
    if (!investor) {
      await session.abortTransaction();
>>>>>>> 54864e09bfb82fba45a6586c3ecb7b9f2ac0e4aa
      return sendError(res, "Investor not found", 404);
    }

    // --- Update fields ---
    if (name) investor.name = name;
    if (profit_percentage !== undefined) investor.profit_percentage = profit_percentage;
    if (join_date) investor.join_date = new Date(join_date);
    if (father_name) investor.father_name = father_name;
    if (mobile_number) investor.mobile_number = mobile_number;
    if (address) investor.address = address;
    if (cnic_number) investor.cnic_number = cnic_number;
    if (cnic_front_photo) investor.cnic_front_photo = cnic_front_photo;
    if (cnic_back_photo) investor.cnic_back_photo = cnic_back_photo;
    if (stam_photo) investor.stam_photo = stam_photo;
    if (check_photo) investor.check_photo = check_photo;

    if (amount !== undefined) {
      investor.amount_invested.push({
        amount,
        date: join_date || new Date()
      });
    }

<<<<<<< HEAD
    if (session) {
      await investor.save({ session });
    } else {
      await investor.save();
    }

    // --- Recalc shares ---
    const investors = session
      ? await Investor.find({ status: "active" }).session(session)
      : await Investor.find({ status: "active" });
=======
    await investor.save({ session });

    // --- Recalc shares ---
    const investors = await Investor.find({ status: "active" }).session(session);
>>>>>>> 54864e09bfb82fba45a6586c3ecb7b9f2ac0e4aa

    const totalCapital = investors.reduce((sum, inv) => {
      const invested = inv.amount_invested.reduce((s, i) => s + i.amount, 0);
      return sum + invested;
    }, 0);

    for (const inv of investors) {
      const invested = inv.amount_invested.reduce((s, i) => s + i.amount, 0);
      inv.shares = totalCapital > 0 ? (invested / totalCapital) * 100 : 0;
<<<<<<< HEAD
      if (session) {
        await inv.save({ session });
      } else {
        await inv.save();
      }
    }

    if (useTransaction && session) {
      await session.commitTransaction();
    }
=======
      await inv.save({ session });
    }

    await session.commitTransaction();
>>>>>>> 54864e09bfb82fba45a6586c3ecb7b9f2ac0e4aa

    // ✅ return plain object (avoid circular JSON error)
    const plainInvestor = investor.toObject();

    return successResponse(
      res,
      "Investor updated successfully and shares recalculated",
      plainInvestor
    );
  } catch (error) {
<<<<<<< HEAD
    if (useTransaction && session) {
      try {
        if (session.inTransaction()) {
          await session.abortTransaction();
        }
      } catch (e) {}
    }
    return sendError(res, error.message);
  } finally {
    if (session) {
      session.endSession();
    }
=======
    // Abort only if still active
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    return sendError(res, error.message);
  } finally {
    session.endSession();
>>>>>>> 54864e09bfb82fba45a6586c3ecb7b9f2ac0e4aa
  }
};




// 🔹 Get Single Investor + Profit Summary + Investments
export const getInvestorById = async (req, res) => {
  try {
    const { id } = req.params;
    const investor = await Investor.findById(id).lean(); // lean for plain JS object

    if (!investor) return sendError(res, "Investor not found", 404);

    // Fetch profits for this investor
    const profitsRaw = await investorProfit.find({ investor_id: id })
      .sort({ month: -1 })
      .lean();

    // Attach invoice_number for each profit record
    const profits = await Promise.all(
      profitsRaw.map(async (p) => {
        let invoice_number = null;
        if (p.order_id) {
          const order = await Order.findById(p.order_id)
            .select("invoice_number")
            .lean();
          invoice_number = order ? order.invoice_number : null;
        }
        return { ...p, invoice_number };
      })
    );

    // Calculate totals
    let totalGrossProfit = 0;
    let totalNetProfit = 0;
    profits.forEach((p) => {
      totalGrossProfit += p.gross_profit || 0;
      totalNetProfit += p.net_profit || 0;
    });

    // Safely calculate total invested amount
    const totalInvested = Array.isArray(investor.amount_invested)
      ? investor.amount_invested.reduce((sum, item) => sum + (item.amount || 0), 0)
      : 0;

    // ✅ Debit / Credit balances
    const debit = investor.debit || 0;
    const credit = investor.credit || 0;
    const net_balance = credit - debit;

    // ✅ All debit_credit entries (manual adjustments / payments)
    const transactions = investor.debit_credit || [];

    return successResponse(res, "Investor retrieved successfully", {
      // 🧾 Core info
      id: investor._id,
      name: investor.name,
      father_name: investor.father_name,
      profit_percentage: investor.profit_percentage,
      shares: investor.shares,
      type: investor.type,
      join_date: investor.join_date,
      status: investor.status,

      // 📞 Contact info
      mobile_number: investor.mobile_number,
      address: investor.address,
      cnic_number: investor.cnic_number,

      // 🖼️ Photo URLs
      cnic_front_photo: investor.cnic_front_photo,
      cnic_back_photo: investor.cnic_back_photo,
      stam_photo: investor.stam_photo,
      check_photo: investor.check_photo,

      // 💵 Investments
      amount_invested: investor.amount_invested,
      total_invested: totalInvested,

      // 💰 balances
      debit,
      credit,
      net_balance,

      // 📊 Profits + Transactions
      profits,        // profits with invoice_number
      transactions,   // full debit_credit history

      summary: {
        totalGrossProfit,
        totalNetProfit,
      },
    });
  } catch (error) {
    console.error("Get investor by ID error:", error);
    return sendError(res, error.message);
  }
};


// ✅ Add Debit/Credit Entry Controller (incremental)
export const addInvestorLedger = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, amount, note, date } = req.body;

    if (!type || !["debit", "credit"].includes(type)) {
      return sendError(res, "Invalid type. Must be 'debit' or 'credit'", 400);
    }
    if (!amount || amount <= 0) {
      return sendError(res, "Amount must be greater than 0", 400);
    }

    const investor = await Investor.findById(id);
    if (!investor) return sendError(res, "Investor not found", 404);

    // 🔹 Add entry to ledger
    investor.debit_credit.push({
      type,
      amount,
      note,
      date: date || new Date(),
    });

    // 🔹 Apply the new transaction to existing balances
    if (type === "credit") {
      investor.credit = (investor.credit || 0) + amount;
    } else if (type === "debit") {
      if ((investor.credit || 0) >= amount) {
        investor.credit -= amount;
      } else {
        const remaining = amount - (investor.credit || 0);
        investor.credit = 0;
        investor.debit = (investor.debit || 0) + remaining;
      }
    }

    investor.net_balance = (investor.credit || 0) - (investor.debit || 0);

    await investor.save();

    return successResponse(res, "Ledger entry added successfully", { investor });
  } catch (error) {
    return sendError(res, error.message);
  }
};




// ✅ Edit Debit/Credit Entry Controller (incremental)
export const editInvestorLedger = async (req, res) => {
  try {
    const { id, entryId } = req.params; // investor id & ledger entry id
    const { type, amount, note, date } = req.body;

    if (!type || !["debit", "credit"].includes(type)) {
      return sendError(res, "Invalid type. Must be 'debit' or 'credit'", 400);
    }
    if (!amount || amount <= 0) {
      return sendError(res, "Amount must be greater than 0", 400);
    }

    const investor = await Investor.findById(id);
    if (!investor) return sendError(res, "Investor not found", 404);

    // 🔹 Find ledger entry
    const entry = investor.debit_credit.id(entryId);
    if (!entry) return sendError(res, "Ledger entry not found", 404);

    // 🔹 Revert the old entry effect
    if (entry.type === "credit") {
      investor.credit -= entry.amount;
    } else if (entry.type === "debit") {
      if (investor.debit >= entry.amount) {
        investor.debit -= entry.amount;
      } else {
        const remaining = entry.amount - investor.debit;
        investor.debit = 0;
        investor.credit += remaining; // revert if debit had consumed credit
      }
    }

    // 🔹 Update entry values
    entry.type = type;
    entry.amount = amount;
    entry.note = note;
    entry.date = date || new Date();

    // 🔹 Apply new entry effect
    if (type === "credit") {
      investor.credit += amount;
    } else if (type === "debit") {
      if (investor.credit >= amount) {
        investor.credit -= amount;
      } else {
        const remaining = amount - investor.credit;
        investor.credit = 0;
        investor.debit += remaining;
      }
    }

    // 🔹 Recalculate net balance
    investor.net_balance = (investor.credit || 0) - (investor.debit || 0);

    await investor.save();

    return successResponse(res, "Ledger entry updated successfully", { investor });
  } catch (error) {
    return sendError(res, error.message);
  }
};


// 🔹 Get all transactions for a single investor
export const getInvestorTransactions = async (req, res) => {
  try {
    const { id } = req.params; // investor id
    const investor = await Investor.findById(id).lean();

    if (!investor) return sendError(res, "Investor not found", 404);

    // Return all debit/credit entries
    return successResponse(res, "Transactions retrieved successfully", {
      investor: {
        id: investor._id,
        name: investor.name,
        credit: investor.credit,
        debit: investor.debit,
        net_balance: (investor.credit || 0) - (investor.debit || 0),
        transactions: investor.debit_credit || [],
      },
    });
  } catch (error) {
    return sendError(res, error.message);
  }
};

// 🔹 Get single transaction for investor
export const getInvestorTransactionById = async (req, res) => {
  try {
    const { id, transactionId } = req.params;

    const investor = await Investor.findById(id).lean();
    if (!investor) return sendError(res, "Investor not found", 404);

    const transaction = investor.debit_credit.find(
      (t) => t._id.toString() === transactionId
    );

    if (!transaction) return sendError(res, "Transaction not found", 404);

    return successResponse(res, "Transaction retrieved successfully", {
      investor: { id: investor._id, name: investor.name },
      transaction,
    });
  } catch (error) {
    return sendError(res, error.message);
  }
};


// ✅ Delete Debit/Credit Entry Controller
export const deleteInvestorLedger = async (req, res) => {
  try {
    const { id, entryId } = req.params; // investor id & ledger entry id

    const investor = await Investor.findById(id);
    if (!investor) return sendError(res, "Investor not found", 404);

    // 🔹 Remove the ledger entry
    const entry = investor.debit_credit.id(entryId);
    if (!entry) return sendError(res, "Ledger entry not found", 404);

    investor.debit_credit.pull({ _id: entryId });

    // 🔹 Recalculate balances from all remaining transactions
    let creditTotal = 0;
    let debitTotal = 0;

    for (const tx of investor.debit_credit) {
      if (tx.type === "credit") {
        creditTotal += tx.amount;
      } else if (tx.type === "debit") {
        if (creditTotal >= tx.amount) {
          creditTotal -= tx.amount;
        } else {
          debitTotal += tx.amount - creditTotal;
          creditTotal = 0;
        }
      }
    }

    investor.credit = creditTotal;
    investor.debit = debitTotal;
    investor.net_balance = creditTotal - debitTotal;

    await investor.save();

    return successResponse(res, "Ledger entry deleted successfully", { investor });
  } catch (error) {
    return sendError(res, error.message);
  }
};



// 🔹 Calculate & Distribute Monthly Profit
const calculateMonthlyProfit = async (req, res) => {
  try {
    const { month, sales } = req.body; // e.g. month = "2025-09"

    const investors = await Investor.find();
    if (investors.length === 0) return sendError(res, "No investors found");

    // Step 1: Total investment
    const totalInvestment = investors.reduce((sum, inv) => {
      const investedUpToMonth = inv.amount_invested
        .filter(i => new Date(i.date) <= new Date(`${month}-01`))
        .reduce((s, i) => s + i.amount, 0);
      inv._effective_investment = investedUpToMonth; // save for profit calculation
      return sum + investedUpToMonth;
    }, 0);

    // Step 2: Shared values
    const grossProfit = sales;
    const expense = (2 / 100) * sales;
    const charity = (10 / 100) * sales;
    const netProfit = grossProfit - expense - charity;

    let results = [];

    for (let inv of investors) {
      const eligibility = checkEligibility(inv.join_date, month);
      if (!eligibility) continue; // not eligible this month

      const percentage = (inv.amount_invested / totalInvestment) * 100;

      let grossShare = (grossProfit * percentage) / 100;
      if (eligibility === "half") {
        grossShare = grossShare / 2; // half month share
      }

      const expenseShare = (expense * percentage) / 100;
      const charityShare = (charity * percentage) / 100;
      const netShare = grossShare - expenseShare - charityShare;

      const investorShare = netShare * 0.5;
      const ownerShare = netShare * 0.5;

      inv.profits.push({
        month,
        sales,
        gross_profit: grossShare,
        expense: expenseShare,
        charity: charityShare,
        net_profit: netShare,
        investor_share: investorShare,
        owner_share: ownerShare,
        total: investorShare + ownerShare,
      });

      await inv.save();

      results.push({
        id: inv._id,
        name: inv.name,
        join_date: inv.join_date,
        eligibility,
        grossProfit: grossShare.toFixed(2),
        expense: expenseShare.toFixed(2),
        charity: charityShare.toFixed(2),
        netProfit: netShare.toFixed(2),
        investorShare: investorShare.toFixed(2),
        ownerShare: ownerShare.toFixed(2),
      });
    }

    return successResponse(res, "Monthly profit distributed", {
      summary: { sales, grossProfit, expense, charity, netProfit },
      details: results,
    });
  } catch (error) {
    return sendError(res, error.message);
  }
};

// ✅ Recalculate/Sync investor balance from all transactions
const recalculateInvestorBalance = async (req, res) => {
  try {
    const { id } = req.params;
    const investor = await Investor.findById(id);
    if (!investor) return sendError(res, "Investor not found", 404);

    let creditTotal = 0;
    let debitTotal = 0;

    // Recalculate balances from all debit_credit transactions
    for (const tx of investor.debit_credit) {
      if (tx.type === "credit") {
        creditTotal += tx.amount;
      } else if (tx.type === "debit") {
        if (creditTotal >= tx.amount) {
          creditTotal -= tx.amount;
        } else {
          debitTotal += tx.amount - creditTotal;
          creditTotal = 0;
        }
      }
    }

    investor.credit = creditTotal;
    investor.debit = debitTotal;
    investor.net_balance = creditTotal - debitTotal;

    await investor.save();

    return successResponse(res, "Investor balance recalculated and synced successfully", { investor });
  } catch (error) {
    return sendError(res, error.message);
  }
};

const investorController = {
  addInvestor,
  editInvestor,
  getInvestors,
  getInvestorById,
  addInvestorLedger,
  addInvestment,
  calculateMonthlyProfit,
  updateInvestment,
  getInvestorTransactions,
  getInvestorTransactionById,
  editInvestorLedger,
  deleteInvestorLedger,
  recalculateInvestorBalance
};

export default investorController;
