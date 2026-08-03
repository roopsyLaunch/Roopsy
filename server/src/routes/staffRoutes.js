const express = require("express");
const router  = express.Router();
const { authRequired, requireRole } = require("../middleware/auth");
const ctrl = require("../controllers/staffController");

router.get(   "/",                               authRequired, requireRole("tailor"), ctrl.listStaff);
router.post(  "/",                               authRequired, requireRole("tailor"), ctrl.addStaff);
router.get(   "/:id",                            authRequired, requireRole("tailor"), ctrl.getStaffById);
router.patch( "/:id",                            authRequired, requireRole("tailor"), ctrl.updateStaff);
router.delete("/:id",                            authRequired, requireRole("tailor"), ctrl.deleteStaff);
router.post(  "/:id/attendance",                 authRequired, requireRole("tailor"), ctrl.markAttendance);
router.post(  "/:id/tasks",                      authRequired, requireRole("tailor"), ctrl.addTask);
router.patch( "/:staffId/tasks/:taskId",         authRequired, requireRole("tailor"), ctrl.updateTask);

module.exports = router;
