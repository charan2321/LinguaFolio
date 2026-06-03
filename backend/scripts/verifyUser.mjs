import 'dotenv/config';
import mongoose from 'mongoose';
import { User } from '../src/modules/users/user.model.ts';

const email = process.argv[2] || 'tester+1@example.com';

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const res = await User.updateOne({ email }, { $set: { isVerified: true } });
    console.log('updateResult', res);
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
};

run();
