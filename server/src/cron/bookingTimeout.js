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
                 
                 // Save notification
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

      // Reminder Notifications
      const reminderWindow30Start = new Date(now.getTime() + 30 * 60000);
      const reminderWindow30End = new Date(now.getTime() + 31 * 60000);
      
      const reminderWindow10Start = new Date(now.getTime() + 10 * 60000);
      const reminderWindow10End = new Date(now.getTime() + 11 * 60000);

      const upcomingBookings = await Booking.find({
        status: "confirmed",
        $or: [
           { startTime: { $gte: reminderWindow30Start, $lt: reminderWindow30End } },
           { startTime: { $gte: reminderWindow10Start, $lt: reminderWindow10End } }
        ]
      });

      for (const b of upcomingBookings) {
         if (!b.customerId) continue;
         const diff = b.startTime.getTime() - now.getTime();
         const is30 = diff > 20 * 60000;
         const title = is30 ? "Booking in 30 minutes" : "Booking in 10 minutes";
         const body = is30 ? "Your salon appointment starts in 30 minutes. Be ready!" : "Your salon appointment starts in 10 minutes. Please arrive now.";
         
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
  }, 60000); 
}

function stopBookingTimeoutCron() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

module.exports = { startBookingTimeoutCron, stopBookingTimeoutCron };
