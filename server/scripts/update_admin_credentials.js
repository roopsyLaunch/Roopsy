const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

async function updateAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB Atlas');

    const newEmail = 'priyanshu@roopsy.com';
    const newPassword = 'Priyanshu@roopsy@@';
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    const result = await mongoose.connection.collection('users').updateOne(
      { role: 'admin' },
      { 
        $set: { 
          email: newEmail, 
          passwordHash: newPasswordHash,
          updatedAt: new Date()
        } 
      }
    );

    console.log('Update result:', result);

    const updated = await mongoose.connection.collection('users').findOne({ role: 'admin' });
    console.log('Admin record successfully updated:');
    console.log({
      id: updated._id,
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      role: updated.role
    });

    const verifyMatch = await bcrypt.compare(newPassword, updated.passwordHash);
    console.log('Password verification check passed:', verifyMatch);

    process.exit(0);
  } catch (err) {
    console.error('Error updating admin:', err);
    process.exit(1);
  }
}

updateAdmin();
