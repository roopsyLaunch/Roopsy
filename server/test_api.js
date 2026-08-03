require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const bookingController = require('./src/controllers/bookingController');

const app = express();
app.get('/availability', bookingController.availableSlots);

mongoose.connect(process.env.MONGODB_URI).then(() => {
  const server = app.listen(0, async () => {
    const port = server.address().port;
    const url = `http://localhost:${port}/availability?barberId=6a3d849d569eee2df913300c&serviceId=6a4158f5ccc2720dcb933feb&date=2026-06-30`;
    console.log("Fetching:", url);
    
    try {
      const res = await fetch(url);
      const data = await res.json();
      console.log("RESPONSE SLOTS:", data.slots);
      console.log("RESPONSE ALL SLOTS:", data.allSlots);
    } catch (e) {
      console.error(e);
    }
    
    process.exit();
  });
});
