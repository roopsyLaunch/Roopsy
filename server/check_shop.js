require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const Barber = require('./src/models/Barber');
  const barber = await Barber.findById('6a3d849d569eee2df913300c');
  console.log('isShopOpen:', barber.isShopOpen);
  console.log('autoShopStatus:', barber.autoShopStatus);
  process.exit();
});
