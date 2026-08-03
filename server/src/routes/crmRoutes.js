const express = require("express");
const router  = express.Router();
const { authRequired, requireRole } = require("../middleware/auth");
const {
  getCRMCustomers,
  getCRMCustomerDetail,
  updateCRMCustomer,
  getMeasurementVault,
} = require("../controllers/crmController");

// All CRM routes are tailor-only
router.get(  "/customers",                         authRequired, requireRole("tailor"), getCRMCustomers);
router.get(  "/customers/:customerId",             authRequired, requireRole("tailor"), getCRMCustomerDetail);
router.patch("/customers/:customerId",             authRequired, requireRole("tailor"), updateCRMCustomer);
router.get(  "/customers/:customerId/measurements",authRequired, requireRole("tailor"), getMeasurementVault);

module.exports = router;
