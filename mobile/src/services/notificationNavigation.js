import { createNavigationContainerRef } from "@react-navigation/native";

export const navigationRef = createNavigationContainerRef();

/**
 * Route customer or shop partner to the exact booking / queue section based on notification.
 * @param {object} nav - Navigation object (optional, defaults to navigationRef)
 * @param {object} notif - Notification payload, item or content
 * @param {object} user - Current user object
 */
export function navigateByNotification(nav, notif, user) {
  const targetNav = nav && typeof nav.navigate === "function" 
    ? nav 
    : navigationRef.isReady() 
      ? navigationRef 
      : null;

  if (!targetNav) {
    console.warn("[NotificationNav] Navigation target is not ready yet.");
    return;
  }

  if (!notif) return;

  const data = notif.data || notif;
  const title = (notif.title || notif.request?.content?.title || "").toLowerCase();
  const body = (notif.body || notif.request?.content?.body || "").toLowerCase();
  const type = (data.type || notif.type || "").toLowerCase();
  const role = user?.role || "customer";

  console.log(`[NotificationNav] Role: ${role}, Type: ${type}, Title: "${title}"`);

  // Detect if notification is about live shop queue, seat, waiting, turn, chair
  const isQueue =
    title.includes("queue") ||
    body.includes("queue") ||
    title.includes("turn") ||
    body.includes("turn") ||
    title.includes("chair") ||
    body.includes("chair") ||
    title.includes("slot") ||
    body.includes("slot") ||
    type.includes("queue") ||
    type.includes("turn");

  // Detect if notification is about tailor / stitching
  const isTailor =
    type.includes("tailor") ||
    title.includes("tailor") ||
    body.includes("tailor") ||
    title.includes("stitch") ||
    body.includes("stitch") ||
    title.includes("fabric") ||
    title.includes("delivery otp") ||
    body.includes("delivery otp");

  // ==========================================
  // 1. BARBER / SALON PARTNER NAVIGATION
  // ==========================================
  if (role === "barber") {
    // If notification is about shop queue or seats:
    if (isQueue) {
      try {
        targetNav.navigate("LiveSlots");
        return;
      } catch (err) {
        console.log("[NotificationNav] LiveSlots navigation error:", err);
      }
    }

    // Default partner booking navigation:
    // Open MyBookings or Partners (Shop Dashboard)
    try {
      targetNav.navigate("MyBookings", { bookingId: data.bookingId });
      return;
    } catch (err) {
      try {
        targetNav.navigate("Partners");
        return;
      } catch (e) {
        console.log("[NotificationNav] Barber nav error:", e);
      }
    }
  }

  // ==========================================
  // 2. TAILOR PARTNER NAVIGATION
  // ==========================================
  if (role === "tailor") {
    try {
      // In RootNavigator, for tailor: MyBookings tab is TailorOrdersScreen!
      targetNav.navigate("MyBookings", { orderId: data.orderId || data.bookingId });
      return;
    } catch (err) {
      try {
        targetNav.navigate("Partners");
        return;
      } catch (e) {
        console.log("[NotificationNav] Tailor nav error:", e);
      }
    }
  }

  // ==========================================
  // 3. CUSTOMER NAVIGATION
  // ==========================================
  // If specific tailor measurement reminder
  if (title.includes("measurement") || body.includes("measurement")) {
    try {
      targetNav.navigate("MeasurementList");
      return;
    } catch (e) {}
  }

  // For any booking confirmation, queue countdown, haircut start, cancellation:
  // Navigate to MyBookings tab!
  try {
    targetNav.navigate("MyBookings", { bookingId: data.bookingId || data.orderId });
  } catch (err) {
    console.log("[NotificationNav] Customer nav error:", err);
  }
}
