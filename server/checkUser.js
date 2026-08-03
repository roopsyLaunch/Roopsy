const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./src/models/User');
const Barber = require('./src/models/Barber');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const user = await User.findOne({email: 'starpriyanshu6@gmail.com'});
  if (!user) {
    console.log('User not found');
    process.exit(0);
  }
  console.log('User:', user);
  const barber = await Barber.findOne({userId: user._id});
  console.log('Barber:', barber);
  
  if (user.role !== 'admin' && user.role !== 'barber') {
    console.log('Updating user role to barber...');
    user.role = 'barber';
    await user.save();
  }
  
  if (barber && barber.approvalStatus !== 'approved') {
    console.log('Updating barber approvalStatus to approved...');
    barber.approvalStatus = 'approved';
    await barber.save();
  } else if (!barber) {
    console.log('Barber profile does not exist. We need to create it or the user might just be in wrong role.');
  }

  process.exit(0);
}

run().catch(console.error);
