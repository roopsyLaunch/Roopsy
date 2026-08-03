const fs = require('fs');

let content = fs.readFileSync('src/controllers/bookingController.js', 'utf8');

// Update create function
content = content.replace(
  'await booking.populate("serviceIds");\n  return res.status(201).json({',
  \`await booking.populate("serviceIds");
  
  const io = req.app.get("io");
  if (io) {
    io.to(\\\`barber_\${barber._id.toString()}\\\`).emit("slotsUpdated", { seats: barber.seats });
  }
  
  return res.status(201).json({\`
);

// Update patch function
// In patch, we have:
//   const io = req.app.get("io");
//   if (io) {
//     io.to(`user_${booking.customerId.toString()}`).emit("bookingUpdated", { bookingId: booking._id });
//     if (barber) {
//       io.to(`user_${barber.userId.toString()}`).emit("bookingUpdated", { bookingId: booking._id });
//     }
//   }
// We just need to add the barber slotsUpdated emit here as well.
content = content.replace(
  \`    if (barber) {
      io.to(\\\`user_\${barber.userId.toString()}\\\`).emit("bookingUpdated", { bookingId: booking._id });
    }\`,
  \`    if (barber) {
      io.to(\\\`user_\${barber.userId.toString()}\\\`).emit("bookingUpdated", { bookingId: booking._id });
      io.to(\\\`barber_\${barber._id.toString()}\\\`).emit("slotsUpdated", { seats: barber.seats });
    }\`
);

fs.writeFileSync('src/controllers/bookingController.js', content);
console.log('Successfully updated socket emits.');
