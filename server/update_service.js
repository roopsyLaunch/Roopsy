require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const Service = require('./src/models/Service');

  const result = await Service.updateOne(
    { name: { $regex: /best beard cutting/i } },
    { $set: { durationMinutes: 20 } }
  );

  console.log("Update result:", result);
  process.exit();
}).catch(err => {
  console.error("DB connection error:", err);
  process.exit(1);
});
