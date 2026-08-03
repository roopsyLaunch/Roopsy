require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const Service = require('./src/models/Service');
  const services = await Service.find({ name: { $regex: /beard/i } });
  console.log(JSON.stringify(services, null, 2));
  process.exit();
});
