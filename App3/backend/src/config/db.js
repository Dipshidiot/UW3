import mongoose from 'mongoose';

const connectDatabase = async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error('MONGO_URI is not configured. Add it to backend/.env.');
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(mongoUri);
  console.log('MongoDB connected');
};

export default connectDatabase;
