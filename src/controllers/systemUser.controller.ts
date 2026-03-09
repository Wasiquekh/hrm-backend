import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import sequelize from '../config/database';
import * as yup from 'yup';

// Validation Schemas
const createUserSchema = yup.object({
  name: yup.string().required('Name is required').min(2).max(50),
  email: yup.string().required('Email is required').email(),
  mobile_number: yup.string().required('Mobile number is required').matches(/^[0-9]{10}$/, '10 digits required'),
  password: yup.string().required('Password is required').min(6)
});

const updateUserSchema = yup.object({
  name: yup.string().min(2).max(50).optional(),
  email: yup.string().email().optional(),
  mobile_number: yup.string().matches(/^[0-9]{10}$/, '10 digits required').optional(),
  password: yup.string().min(6).optional()
});

// ==================== 1. CREATE USER ====================
export const createUser = async (req: Request, res: Response) => {
  try {
    await createUserSchema.validate(req.body, { abortEarly: false });
    
    const { name, mobile_number, email, password } = req.body;

    // Check if user exists
    const existingUser = await sequelize.query(
      `SELECT id, email, mobile_number, deleted_at 
       FROM system_users 
       WHERE email = :email OR mobile_number = :mobile_number`,
      { replacements: { email, mobile_number }, type: 'SELECT' }
    );

    // ✅ Fix: Type assertion for array check
    if ((existingUser as any[]).length > 0) {
      const user = (existingUser as any[])[0];
      
      // Agar soft deleted hai to restore kar do
      if (user.deleted_at) {
        await sequelize.query(
          `UPDATE system_users 
           SET deleted_at = NULL, updated_at = NOW() 
           WHERE id = :id`,
          { replacements: { id: user.id }, type: 'UPDATE' }
        );
        
        return res.status(200).json({
          success: true,
          message: 'User restored successfully',
          user: {
            id: user.id,
            name,
            email,
            mobile_number
          }
        });
      }
      
      // Agar active user hai to error do
      let message = 'User already exists with this ';
      message += user.email === email ? 'email' : 'mobile number';
      return res.status(400).json({ success: false, message });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    await sequelize.query(
      `INSERT INTO system_users 
       (name, mobile_number, email, password, created_at, updated_at) 
       VALUES (:name, :mobile_number, :email, :password, :created_at, :updated_at)`,
      {
        replacements: {
          name, mobile_number, email,
          password: hashedPassword,
          created_at: new Date(),
          updated_at: new Date()
        },
        type: 'INSERT'
      }
    );

    // Fetch created user
    const newUser = await sequelize.query(
      `SELECT id, name, email, mobile_number, created_at 
       FROM system_users 
       WHERE email = :email`,
      { replacements: { email }, type: 'SELECT' }
    );

    // ✅ Fix: Type assertion
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: (newUser as any[])[0]
    });

  } catch (error) {
    if (error instanceof yup.ValidationError) {
      return res.status(400).json({ 
        success: false, 
        message: error.errors[0] 
      });
    }
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ==================== 2. GET ALL USERS ====================
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search as string || '';

    let whereClause = 'WHERE deleted_at IS NULL';
    const replacements: any = { limit, offset };

    if (search) {
      whereClause += ` AND (name ILIKE :search OR email ILIKE :search OR mobile_number ILIKE :search)`;
      replacements.search = `%${search}%`;
    }

    // Get total count
    const countResult = await sequelize.query(
      `SELECT COUNT(*) as total FROM system_users ${whereClause}`,
      { replacements, type: 'SELECT' }
    );
    
    // ✅ Fix: Type assertion
    const total = parseInt((countResult as any[])[0]?.total) || 0;

    // Get users
    const users = await sequelize.query(
      `SELECT id, name, email, mobile_number, totp_secret, created_at, updated_at 
       FROM system_users 
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT :limit OFFSET :offset`,
      { replacements, type: 'SELECT' }
    );

    res.json({
      success: true,
      data: users,
      pagination: {
        page, limit, total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ==================== 3. GET USER BY ID ====================
export const getUserById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const users = await sequelize.query(
      `SELECT id, name, email, mobile_number, totp_secret, created_at, updated_at 
       FROM system_users 
       WHERE id = :id AND deleted_at IS NULL`,
      { replacements: { id }, type: 'SELECT' }
    );

    // ✅ Fix: Type assertion for array check
    if ((users as any[]).length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user: (users as any[])[0]
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ==================== 4. UPDATE USER ====================
export const updateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    await updateUserSchema.validate(req.body, { abortEarly: false });
    
    const { name, mobile_number, email, password } = req.body;

    // Check if user exists
    const users = await sequelize.query(
      `SELECT id FROM system_users WHERE id = :id AND deleted_at IS NULL`,
      { replacements: { id }, type: 'SELECT' }
    );

    // ✅ Fix: Type assertion
    if ((users as any[]).length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if email/mobile already taken by another user
    if (email || mobile_number) {
      const existingUser = await sequelize.query(
        `SELECT id, email, mobile_number 
         FROM system_users 
         WHERE (email = :email OR mobile_number = :mobile_number) 
         AND id != :id AND deleted_at IS NULL`,
        {
          replacements: { 
            email: email || '', 
            mobile_number: mobile_number || '', 
            id 
          },
          type: 'SELECT'
        }
      );

      // ✅ Fix: Type assertion
      if ((existingUser as any[]).length > 0) {
        const user = (existingUser as any[])[0];
        let message = 'User already exists with this ';
        if (user.email === email) message += 'email';
        else if (user.mobile_number === mobile_number) message += 'mobile number';
        
        return res.status(400).json({ success: false, message });
      }
    }

    // Build update query
    const updates: string[] = [];
    const replacements: any = { id };

    if (name) {
      updates.push('name = :name');
      replacements.name = name;
    }
    if (email) {
      updates.push('email = :email');
      replacements.email = email;
    }
    if (mobile_number) {
      updates.push('mobile_number = :mobile_number');
      replacements.mobile_number = mobile_number;
    }
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updates.push('password = :password');
      replacements.password = hashedPassword;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updates.push('updated_at = NOW()');

    // Update user
    await sequelize.query(
      `UPDATE system_users SET ${updates.join(', ')} WHERE id = :id`,
      { replacements, type: 'UPDATE' }
    );

    // Fetch updated user
    const updatedUser = await sequelize.query(
      `SELECT id, name, email, mobile_number, created_at, updated_at 
       FROM system_users 
       WHERE id = :id`,
      { replacements: { id }, type: 'SELECT' }
    );

    res.json({
      success: true,
      message: 'User updated successfully',
      user: (updatedUser as any[])[0]
    });

  } catch (error) {
    if (error instanceof yup.ValidationError) {
      return res.status(400).json({ 
        success: false, 
        message: error.errors[0] 
      });
    }
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ==================== 5. DELETE USER (SOFT DELETE) ====================
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const users = await sequelize.query(
      `SELECT id FROM system_users WHERE id = :id AND deleted_at IS NULL`,
      { replacements: { id }, type: 'SELECT' }
    );

    // ✅ Fix: Type assertion
    if ((users as any[]).length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found or already deleted'
      });
    }

    // Soft delete
    await sequelize.query(
      `UPDATE system_users SET deleted_at = NOW() WHERE id = :id`,
      { replacements: { id }, type: 'UPDATE' }
    );

    res.json({
      success: true,
      message: 'User deleted successfully (soft delete)'
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ==================== 6. RESET TOTP SECRET ====================
export const resetTotpSecret = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const users = await sequelize.query(
      `SELECT id FROM system_users WHERE id = :id AND deleted_at IS NULL`,
      { replacements: { id }, type: 'SELECT' }
    );

    if ((users as any[]).length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update totp_secret to NULL
    await sequelize.query(
      `UPDATE system_users SET totp_secret = NULL, updated_at = NOW() WHERE id = :id`,
      { replacements: { id }, type: 'UPDATE' }
    );

    res.json({
      success: true,
      message: 'TOTP secret reset successfully'
    });

  } catch (error) {
    console.error('Error resetting TOTP secret:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};