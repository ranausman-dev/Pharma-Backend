import { User } from "../models/userModel.js";
import { UserLedger } from "../models/userLedgerModel.js";
import { sendError, successResponse } from "../utils/response.js";

const addUserLedger = async (req, res) => {
  try {
    const { user_id, description, debit, credit, incentive_amount, order_id } = req.body;

    // Check if user exists
    const user = await User.findById(user_id);
    if (!user) {
      return sendError(res, "User not found", 404);
    }

    // Create new ledger entry
    const newEntry = await UserLedger.create({
      user_id,
      description,
      debit,
      credit,
      incentive_amount,
      order_id,
      total_balance: `${Math.abs(credit - debit)} ${credit >= debit ? "CR" : "DB"}`
    });

    return successResponse(res, "Ledger entry added successfully", { newEntry });
  } catch (error) {
    return sendError(res, error.message);
  }
}



// Get all ledger entries for a specific user with calculated balance
const getUserLedgers = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const user = await User.findById(id);
    if (!user) {
      return sendError(res, "User not found", 404);
    }

    // Get all ledger entries for the user sorted by date (oldest first for running balance)
    const ledgers = await UserLedger.find({ user_id: id }).sort({ date: 1, createdAt: 1 });

    // Calculate running balance for each entry
    let runningBalance = 0;
    const ledgersWithBalance = ledgers.map((entry, index) => {
      // Credit increases balance, Debit decreases balance
      runningBalance = runningBalance + entry.credit - entry.debit;

      return {
        ...entry.toObject(),
        transaction_no: index + 1,
        running_balance: runningBalance,
        balance_type: runningBalance >= 0 ? "CR" : "DB",
        balance_amount: Math.abs(runningBalance),
        balance_display: `${Math.abs(runningBalance)} ${runningBalance >= 0 ? "CR" : "DB"}`
      };
    });

    // Reverse to show newest first (as original)
    ledgersWithBalance.reverse();

    // Calculate totals
    let totalCredit = 0;
    let totalDebit = 0;
    let totalIncentive = 0;

    ledgers.forEach(entry => {
      totalCredit += entry.credit;
      totalDebit += entry.debit;
      totalIncentive += entry.incentive_amount || 0;
    });

    const balance = totalCredit - totalDebit;
    const balanceDisplay = `${Math.abs(balance)} ${balance >= 0 ? "CR" : "DB"}`;

    return successResponse(res, "User ledgers retrieved successfully", {
      ledgers: ledgersWithBalance,
      summary: {
        totalCredit,
        totalDebit,
        totalIncentive,
        currentBalance: balanceDisplay,
        finalBalance: balance,
        balanceType: balance >= 0 ? "CR" : "DB"
      }
    });
  } catch (error) {
    return sendError(res, error.message);
  }
}


// Edit an existing ledger entry
const editUserLedger = async (req, res) => {
  try {
    const { id } = req.params; // Ledger entry ID
    const { description, debit, credit, incentive_amount, order_id, date } = req.body;

    // Find ledger entry
    const ledgerEntry = await UserLedger.findById(id);
    if (!ledgerEntry) {
      return sendError(res, "Ledger entry not found", 404);
    }

    // Optional: Check if related user exists
    const user = await User.findById(ledgerEntry.user_id);
    if (!user) {
      return sendError(res, "User not found", 404);
    }

    // Update fields
    ledgerEntry.description = description ?? ledgerEntry.description;
    ledgerEntry.debit = debit ?? ledgerEntry.debit;
    ledgerEntry.credit = credit ?? ledgerEntry.credit;
    ledgerEntry.incentive_amount = incentive_amount ?? ledgerEntry.incentive_amount;
    ledgerEntry.order_id = order_id ?? ledgerEntry.order_id;
    if (date) ledgerEntry.date = new Date(date);

    // Recalculate total_balance
    ledgerEntry.total_balance = `${Math.abs(ledgerEntry.credit - ledgerEntry.debit)} ${ledgerEntry.credit >= ledgerEntry.debit ? "CR" : "DB"}`;

    await ledgerEntry.save();

    return successResponse(res, "Ledger entry updated successfully", { updatedEntry: ledgerEntry });
  } catch (error) {
    return sendError(res, error.message);
  }
};


const userLedgerController = {
  addUserLedger,
  getUserLedgers,
  editUserLedger
};

export default userLedgerController;
