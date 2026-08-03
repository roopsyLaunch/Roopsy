const express = require("express");
const router  = express.Router();
const { authRequired, requireRole } = require("../middleware/auth");
const ctrl = require("../controllers/financeController");

router.get("/summary",           authRequired, requireRole("tailor"), ctrl.getRevenueSummary);
router.get("/expenses",          authRequired, requireRole("tailor"), ctrl.listExpenses);
router.post("/expenses",         authRequired, requireRole("tailor"), ctrl.addExpense);
router.delete("/expenses/:id",   authRequired, requireRole("tailor"), ctrl.deleteExpense);
router.get("/cashbook",          authRequired, requireRole("tailor"), ctrl.getCashbook);
router.post("/cashbook",         authRequired, requireRole("tailor"), ctrl.addCashbookEntry);
router.get("/analytics",         authRequired, requireRole("tailor"), ctrl.getAnalytics);

module.exports = router;
