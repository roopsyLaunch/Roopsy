const Booking = require("../models/Booking");
const Barber = require("../models/Barber");
const Notification = require("../models/Notification");

let intervalId = null;

function startBookingTimeoutCron(app) {
  if (intervalId) return;

  intervalId = setInterval(async () => {
    try {
      const now = new Date();
      
      const activeBookings = await Booking.find({
        status: { $in: ["pending", "confirmed"] },
        startTime: { $lt: now }
      }).populate("barberId");

      for (const b of activeBookings) {
        const grace = b.barberId && b.barberId.gracePeriodMinutes ? b.barberId.gracePeriodMinutes : 10;
        const noShowTime = new Date(b.startTime.getTime() + grace * 60000);
        
        if (now > noShowTime) {
          console.log(`[Cron] Marking booking ${b._id} as No-Show`);
          b.status = "no-show";
          b.noShowAt = now;
          b.queuePosition = 0; 
          
          if (b.barberId && b.seatIndex !== undefined && b.seatIndex !== null) {
            const barber = await Barber.findById(b.barberId._id || b.barberId);
            if (barber) {
              const seat = barber.seats.find(s => s.index === b.seatIndex);
              if (seat) {
                seat.isAvailable = true;
                await barber.save();
                const io = app.get("io");
                if (io) io.to(`barber_${barber._id.toString()}`).emit("slotsUpdated", { seats: barber.seats });
              }
            }
          }
          await b.save();

          const io = app.get("io");
          if (io) {
            if (b.barberId) {
              io.to(`barber_${(b.barberId._id || b.barberId).toString()}`).emit("queueUpdated");
            }
            if (b.customerId) {
              io.to(`user_${b.customerId.toString()}`).emit("bookingUpdated");
            }
          }
        }
      }

      // Delay Detection
      const inProgressBookings = await Booking.find({
        status: "in-progress"
      });

      for (const b of inProgressBookings) {
        if (!b.startedAt) continue;
        const expectedEnd = new Date(b.startedAt.getTime() + (b.expectedDuration || 30) * 60000);
        if (now > expectedEnd) {
          const delay = Math.floor((now.getTime() - expectedEnd.getTime()) / 60000);
          if (b.delayMinutes !== delay && delay > 0) {
            b.delayMinutes = delay;
            await b.save();
            const io = app.get("io");
            if (io) {
              if (b.barberId) {
                io.to(`barber_${b.barberId.toString()}`).emit("queueUpdated");
              }
              if (b.customerId) {
                 io.to(`user_${b.customerId.toString()}`).emit("delayAlert", { delayMinutes: delay });
                 
                 // Update existing delay notification or create one if none exists
                 const existingDelayNotif = await Notification.findOne({
                    userId: b.customerId,
                    "data.bookingId": b._id,
                    type: "delay"
                 });
                 if (existingDelayNotif) {
                    existingDelayNotif.body = `Your barber is currently delayed by ${delay} minutes.`;
                    await existingDelayNotif.save();
                 } else {
                    await Notification.create({
                       userId: b.customerId,
                       title: "Service Delayed",
                       body: `Your barber is currently delayed by ${delay} minutes.`,
                       type: "delay",
                       data: { bookingId: b._id }
                    });
                 }
              }
            }
          }
        }
      }

      // ==========================================
      // 10-Minute Upcoming Turn Notifications
      // For Barber & Beauty Parlour styling chairs
      // ==========================================

      // Condition A: Customer is currently in-progress on a chair (e.g. 50 mins into a 60 min session)
      // When 10 minutes or fewer remain on the active service, notify the NEXT customer waiting for that same chair.
      const activeChairBookings = await Booking.find({
        status: "in-progress",
        isHomeService: false,
        seatIndex: { $ne: null }
      }).populate("barberId");

      for (const curBooking of activeChairBookings) {
        if (!curBooking.barberId) continue;
        const barberId = curBooking.barberId._id || curBooking.barberId;
        const startTimeRef = curBooking.startedAt || curBooking.startTime;
        if (!startTimeRef) continue;

        const duration = curBooking.expectedDuration || Math.round((new Date(curBooking.endTime).getTime() - new Date(curBooking.startTime).getTime()) / 60000) || 30;
        const elapsedMinutes = (now.getTime() - new Date(startTimeRef).getTime()) / 60000;
        const remainingMinutes = duration - elapsedMinutes;

        // When around 10 minutes remain on the active service (e.g., 50 minutes of 60 have completed)
        if (remainingMinutes <= 10.5 && remainingMinutes >= -15) {
          // Find the next customer in queue or booked on this exact chair
          const nextBooking = await Booking.findOne({
            barberId: barberId,
            seatIndex: curBooking.seatIndex,
            status: { $in: ["pending", "confirmed"] },
            isHomeService: false,
            isTurnReminderSent: { $ne: true },
            _id: { $ne: curBooking._id }
          })
            .sort({ startTime: 1 })
            .populate("barberId")
            .populate("customerId");

          if (nextBooking && nextBooking.customerId) {
            const custId = (nextBooking.customerId._id || nextBooking.customerId).toString();
            const shopName = nextBooking.barberId?.shopName || curBooking.barberId?.shopName || "the salon";
            const chairLabel = nextBooking.seatLabel || (nextBooking.seatIndex !== undefined && nextBooking.seatIndex !== null ? `Chair ${nextBooking.seatIndex + 1}` : "Styling Chair");

            const title = "Your Turn is in 10 Minutes! ⏰";
            const body = `Get ready! The current service on ${chairLabel} at ${shopName} is almost complete (approx. 10 minutes remaining). Please arrive at the shop on time for your turn.`;

            // 1. Save Notification (automatically sends Expo Push notification)
            await Notification.create({
              userId: nextBooking.customerId._id || nextBooking.customerId,
              title,
              body,
              type: "reminder",
              data: {
                bookingId: nextBooking._id,
                type: "turn_reminder",
                shopName,
                seatLabel: chairLabel
              }
            });

            // 2. Mark reminder sent to avoid duplicate alerts
            nextBooking.isTurnReminderSent = true;
            nextBooking.turnReminderSentAt = now;
            await nextBooking.save();

            // 3. Emit real-time socket events
            const io = app.get("io");
            if (io) {
              io.to(`user_${custId}`).emit("turnUpcoming", {
                bookingId: nextBooking._id,
                shopName,
                seatLabel: chairLabel,
                message: body
              });
              io.to(`user_${custId}`).emit("notificationReceived");
              io.to(`user_${custId}`).emit("bookingUpdated", { bookingId: nextBooking._id });
            }

            console.log(`[Cron] Sent 10-min turn reminder to Customer ${custId} for booking ${nextBooking._id} on ${chairLabel} (${shopName})`);
          }
        }
      }

      // Condition B: Scheduled appointment approaching within 10 minutes
      const tenMinutesFromNow = new Date(now.getTime() + 10.5 * 60000);
      const scheduledTurnBookings = await Booking.find({
        status: { $in: ["pending", "confirmed"] },
        isHomeService: false,
        isTurnReminderSent: { $ne: true },
        startTime: {
          $gte: new Date(now.getTime() - 2 * 60000), // from 2 mins ago
          $lte: tenMinutesFromNow                   // up to 10.5 minutes ahead
        }
      })
        .populate("barberId")
        .populate("customerId");

      for (const b of scheduledTurnBookings) {
        if (!b.customerId) continue;
        const custId = (b.customerId._id || b.customerId).toString();
        const shopName = b.barberId?.shopName || "the salon";
        const chairLabel = b.seatLabel || (b.seatIndex !== undefined && b.seatIndex !== null ? `Chair ${b.seatIndex + 1}` : "Styling Chair");
        const minutesLeft = Math.max(1, Math.round((new Date(b.startTime).getTime() - now.getTime()) / 60000));

        const title = "Your Turn is in 10 Minutes! ⏰";
        const body = `Your appointment for ${chairLabel} at ${shopName} starts in approximately ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}. Please arrive at the shop now.`;

        // 1. Save Notification (automatically sends Expo Push notification)
        await Notification.create({
          userId: b.customerId._id || b.customerId,
          title,
          body,
          type: "reminder",
          data: {
            bookingId: b._id,
            type: "turn_reminder",
            shopName,
            seatLabel: chairLabel
          }
        });

        // 2. Mark reminder sent
        b.isTurnReminderSent = true;
        b.turnReminderSentAt = now;
        await b.save();

        // 3. Emit real-time socket events
        const io = app.get("io");
        if (io) {
          io.to(`user_${custId}`).emit("turnUpcoming", {
            bookingId: b._id,
            shopName,
            seatLabel: chairLabel,
            message: body
          });
          io.to(`user_${custId}`).emit("notificationReceived");
          io.to(`user_${custId}`).emit("bookingUpdated", { bookingId: b._id });
        }

        console.log(`[Cron] Sent scheduled 10-min turn reminder to Customer ${custId} for booking ${b._id}`);
      }

      // 30-Minute Advance Courtesy Reminder
      const reminderWindow30Start = new Date(now.getTime() + 29 * 60000);
      const reminderWindow30End = new Date(now.getTime() + 31 * 60000);

      const upcoming30MinBookings = await Booking.find({
        status: "confirmed",
        startTime: { $gte: reminderWindow30Start, $lt: reminderWindow30End }
      });

      for (const b of upcoming30MinBookings) {
        if (!b.customerId) continue;
        const title = "Booking in 30 minutes";
        const body = "Your salon appointment starts in 30 minutes. Please be ready!";
        
        const existingReminder = await Notification.findOne({
          userId: b.customerId,
          "data.bookingId": b._id,
          title
        });
        if (existingReminder) continue;

        await Notification.create({
          userId: b.customerId,
          title,
          body,
          type: "reminder",
          data: { bookingId: b._id }
        });

        const io = app.get("io");
        if (io) io.to(`user_${b.customerId.toString()}`).emit("notificationReceived");
      }

      // Seat Auto-Release (Manual Blocks)
      const barbersWithSeats = await Barber.find({ "seats.occupiedUntil": { $lt: now } });
      for (const barber of barbersWithSeats) {
        let changed = false;
        barber.seats.forEach(seat => {
          if (seat.occupiedUntil && seat.occupiedUntil < now) {
             seat.isAvailable = true;
             seat.occupiedUntil = null;
             changed = true;
          }
        });
        if (changed) {
          await barber.save();
          const io = app.get("io");
          if (io) io.to(`barber_${barber._id.toString()}`).emit("slotsUpdated", { seats: barber.seats });
        }
      }

    } catch (err) {
      console.error("[Cron] Error:", err);
    }
  }, 30000); 
}

function stopBookingTimeoutCron() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

module.exports = { startBookingTimeoutCron, stopBookingTimeoutCron };
