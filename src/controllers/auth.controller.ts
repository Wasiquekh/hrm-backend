import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import sequelize from '../config/database';
import * as yup from 'yup';

// Validation Schema
const loginSchema = yup.object({
  email: yup.string().required('Email is required').email(),
  password: yup.string().required('Password is required').min(6)
});

export const login = async (req: Request, res: Response) => {
  try {
    // Validate input
    await loginSchema.validate(req.body);
    
    const { email, password } = req.body;

    // Find user
    const users = await sequelize.query(
      `SELECT id, name, email, password, totp_secret 
       FROM system_users 
       WHERE email = :email AND deleted_at IS NULL`,
      { replacements: { email }, type: 'SELECT' }
    );

    // Check if user exists
    if (!users || (users as any[]).length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }

    const user = users[0] as any;

    // Verify password
    const validPass = await bcrypt.compare(password, user.password);
    if (!validPass) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }

    // ✅ Generate JWT Token - FIXED with type assertion
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        name: user.name 
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' } as jwt.SignOptions
    );

    // Check if TOTP already setup
    const hasTotp = user.totp_secret !== null && user.totp_secret !== '';

    // Return user data with token
    res.json({
      success: true,
      data: {
        token,
        userId: user.id,
        name: user.name,
        email: user.email,
        hasTotp
      }
    });

  } catch (error) {
    if (error instanceof yup.ValidationError) {
      return res.status(400).json({ 
        success: false, 
        message: error.errors[0] 
      });
    }
    
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};