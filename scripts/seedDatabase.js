require('dotenv').config();

if (!process.env.SEED_SECRET_KEY) {
  console.error('Unauthorized seed execution.');
  process.exit(1);
}

const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');

const connectDB = require('../src/config/db');
const { seedDatabase } = require('../src/utils/seed');

(async () => {
  try {
    await connectDB();
    await seedDatabase();
    process.exitCode = 0;
  } catch (error) {
    console.error('Deployment seed failed:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
})();
