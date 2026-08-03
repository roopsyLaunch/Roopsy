const express = require("express");
const router  = express.Router();
const { authRequired, requireRole } = require("../middleware/auth");
const ctrl = require("../controllers/inventoryController");

router.get(   "/",                    authRequired, requireRole("tailor"), ctrl.listInventory);
router.post(  "/",                    authRequired, requireRole("tailor"), ctrl.createInventoryItem);
router.patch( "/:id",                 authRequired, requireRole("tailor"), ctrl.updateInventoryItem);
router.delete("/:id",                 authRequired, requireRole("tailor"), ctrl.deleteInventoryItem);
router.post(  "/:id/transaction",     authRequired, requireRole("tailor"), ctrl.addTransaction);

module.exports = router;
