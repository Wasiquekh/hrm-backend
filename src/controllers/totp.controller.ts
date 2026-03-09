import { Request, Response } from 'express';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import sequelize from '../config/database';
import * as yup from 'yup';
import jwt from 'jsonwebtoken';

// ============================================
// GENERATE QR CODE (First time users)
// ============================================
export const generateQR = async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID required' 
      });
    }

    // Check if user already has TOTP
    const users = await sequelize.query(
      `SELECT id, email, totp_secret FROM system_users WHERE id = :userId`,
      { replacements: { userId }, type: 'SELECT' }
    );

    if (!users || (users as any[]).length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    const user = users[0] as any;

    // If already has TOTP, don't generate new QR
    if (user.totp_secret) {
      return res.status(400).json({ 
        success: false, 
        message: 'TOTP already setup for this user' 
      });
    }

    // Generate new secret
    const secret = speakeasy.generateSecret({
      name: `HRM:${user.email}`,
      length: 20
    });

    // Generate QR code
    const qrCode = await QRCode.toDataURL(secret.otpauth_url!);

    res.json({
      success: true,
      data: {
        qrCode,
        secretKey: secret.base32  // Frontend store karega (temporary)
      }
    });

  } catch (error) {
    console.error('Generate QR error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// ============================================
// VERIFY TOTP (Both first time & existing)
// ============================================
export const verifyTOTP = async (req: Request, res: Response) => {
  try {
    const { userId, token, secretKey } = req.body;

    if (!userId || !token) {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID and token required' 
      });
    }

    // Get user from database
    const users = await sequelize.query(
      `SELECT id, name, email, totp_secret FROM system_users WHERE id = :userId`,
      { replacements: { userId }, type: 'SELECT' }
    );

    if (!users || (users as any[]).length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    const user = users[0] as any;
    
    // Determine which secret to use
    let secret = user.totp_secret;
    let isFirstTime = false;

    // If user has no secret, use the one from request (first time)
    if (!secret) {
      if (!secretKey) {
        return res.status(400).json({ 
          success: false, 
          message: 'Secret key required for first time setup' 
        });
      }
      secret = secretKey;
      isFirstTime = true;
    }

    // Verify token
    const verified = speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
      window: 1
    });

    if (!verified) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid TOTP code' 
      });
    }

    // If first time, save secret to database
    if (isFirstTime) {
      await sequelize.query(
        `UPDATE system_users SET totp_secret = :secret WHERE id = :userId`,
        { replacements: { secret, userId }, type: 'UPDATE' }
      );
    }

    // Generate JWT token
    const jwtToken = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      data: {
        token: jwtToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email
        }
      }
    });

  } catch (error) {
    console.error('Verify TOTP error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};