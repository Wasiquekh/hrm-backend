import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

// FORCE INDIA TIME
process.env.TZ = 'Asia/Kolkata';

const sequelize = new Sequelize(
  process.env.DB_NAME!,
  process.env.DB_USER!,
  process.env.DB_PASSWORD!,
  {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    dialect: 'postgres',
    logging: false,
    timezone: '+05:30', // India Time
  }
);

export const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected with Indian Time');
    
    // Simple sync - no triggers
    await sequelize.sync({ alter: true });
    console.log('✅ Database synced');
    
  } catch (error) {
    console.error('❌ Database failed:', error);
    process.exit(1);
  }
};

export default sequelize;