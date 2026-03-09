import app from './app';
import { connectDB } from './config/database';

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // do Database connect 
    await connectDB();
    
    // start Server 
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Server start failed:', error);
  }
};

startServer();