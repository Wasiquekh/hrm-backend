import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import systemUserRoutes from './routes/systemUser.routes';

dotenv.config();

const app = express();

// ✅ Ye dono lines IMPORTANT hain
app.use(express.json());              // JSON body parser
app.use(express.urlencoded({ extended: true })); // Form data parser

app.use(cors());

// Routes
app.use('/api', systemUserRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'HRM Backend Running' });
});

export default app;