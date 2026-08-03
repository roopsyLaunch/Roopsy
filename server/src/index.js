const mongoose = require("mongoose");
const app = require("./app");
const { loadConfig } = require("./config");
const { port, mongoUri } = loadConfig();
const { startBookingTimeoutCron } = require("./cron/bookingTimeout");

async function main() {
  try {
    await mongoose.connect(mongoUri);
  } catch (err) {
    const code = err?.cause?.code || err?.code;
    if (code === "ECONNREFUSED" || String(err?.message || "").includes("ECONNREFUSED")) {
      console.error("\n[MongoDB] Connection refused — nothing is listening on your MongoDB address.");
      console.error("  URI in use:", mongoUri.replace(/:[^:@/]+@/, ":****@"));
      console.error("  Fix one of these:");
      console.error("  1) Install/start MongoDB locally, OR");
      console.error("  2) Create a free cluster on MongoDB Atlas and set MONGODB_URI in server/.env\n");
    }
    throw err;
  }
  console.log("MongoDB connected");
  
  const http = require("http");
  const { Server } = require("socket.io");
  
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: "*" },
  });
  
  app.set("io", io);
  
  io.on("connection", (socket) => {
    console.log("New socket connection:", socket.id);
    
    // Clients can join a room for a specific barber to get slot updates
    socket.on("joinBarberRoom", (barberId) => {
      socket.join(`barber_${barberId}`);
      console.log(`Socket ${socket.id} joined room barber_${barberId}`);
    });
    
    socket.on("leaveBarberRoom", (barberId) => {
      socket.leave(`barber_${barberId}`);
    });
    
    // Clients can join a room for their user ID to get personal notifications
    socket.on("joinUserRoom", (userId) => {
      socket.join(`user_${userId}`);
    });
    socket.on("leaveUserRoom", (userId) => {
      socket.leave(`user_${userId}`);
    });
  });

  // Start cron jobs
  startBookingTimeoutCron(app);

  server.listen(port, "0.0.0.0", () => {
    console.log(`API listening on http://localhost:${port} (also use your LAN IP for phone)`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
 
