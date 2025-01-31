import mongoose from "mongoose";

async function connectToDatabase() {
  try {
  console.log("🔗 Connecting to Database...");
    await mongoose.connect(process.env.MONGODB_URI!, {
      serverSelectionTimeoutMS: 5000,
      retryWrites: true,
      w: 'majority' 
    });
    console.log("✅ Database Connected Successfully");
  } catch (error) { 
    console.error("❌ Database Connection Error:", error);
    process.exit(1);
  }
}


export default connectToDatabase;