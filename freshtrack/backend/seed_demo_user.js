require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/freshtrack';

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB.');

  const demoEmail = 'demo@freshtrack.ai';
  let demoUser = await User.findOne({ email: demoEmail });

  if (!demoUser) {
    demoUser = await User.create({
      name: 'Produce Operations Manager',
      email: demoEmail,
      password: 'demo1234',
      role: 'manager',
      company: 'FreshTrack Wholesale Co.'
    });
    console.log('✓ Created default demo user:', demoEmail);
  } else {
    demoUser.password = 'demo1234';
    await demoUser.save();
    console.log('✓ Updated existing demo user password to demo1234');
  }

  await mongoose.disconnect();
}

seed().catch(console.error);
