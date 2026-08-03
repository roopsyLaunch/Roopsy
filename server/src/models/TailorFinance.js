const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema(
  {
    tailorId:    { type: mongoose.Schema.Types.ObjectId, ref: "Tailor", required: true },
    title:       { type: String, required: true, trim: true },
    amount:      { type: Number, required: true },
    category:    {
      type: String,
      enum: ["rent", "salary", "fabric", "utilities", "equipment", "marketing", "transport", "tax", "maintenance", "other"],
      default: "other",
    },
    paymentMode: { type: String, enum: ["cash", "upi", "card", "bank_transfer", "cheque"], default: "cash" },
    note:        { type: String, default: "" },
    date:        { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const cashbookEntrySchema = new mongoose.Schema(
  {
    tailorId:    { type: mongoose.Schema.Types.ObjectId, ref: "Tailor", required: true },
    type:        { type: String, enum: ["credit", "debit"], required: true },
    amount:      { type: Number, required: true },
    description: { type: String, required: true, trim: true },
    category:    { type: String, enum: ["order_payment", "advance", "refund", "expense", "salary", "other"], default: "other" },
    paymentMode: { type: String, enum: ["cash", "upi", "card", "bank_transfer", "cheque"], default: "cash" },
    orderId:     { type: mongoose.Schema.Types.ObjectId, ref: "TailorOrder" },
    date:        { type: Date, default: Date.now },
  },
  { timestamps: true }
);

expenseSchema.index({ tailorId: 1, date: -1 });
cashbookEntrySchema.index({ tailorId: 1, date: -1, type: 1 });

const Expense      = mongoose.model("TailorExpense",      expenseSchema);
const CashbookEntry = mongoose.model("TailorCashbook",    cashbookEntrySchema);

module.exports = { Expense, CashbookEntry };
