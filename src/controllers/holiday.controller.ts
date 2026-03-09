import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import sequelize from '../config/database';
import * as yup from 'yup';

// Validation Schema
const holidaySchema = yup.object({
  date: yup.date().required('Date is required'),
  description: yup.string().required('Description is required').min(2).max(255)
});

// ==================== 1. CREATE HOLIDAY ====================
export const createHoliday = async (req: Request, res: Response) => {
  try {
    await holidaySchema.validate(req.body);
    
    const { date, description } = req.body;
    const holidayId = uuidv4();

    // Check if holiday already exists on this date
    const existingHoliday = await sequelize.query(
      `SELECT id FROM holidays WHERE date = :date`,
      { replacements: { date }, type: 'SELECT' }
    );

    if ((existingHoliday as any[]).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Holiday already exists on this date'
      });
    }

    // Insert holiday
    await sequelize.query(
      `INSERT INTO holidays (id, date, description, created_at, updated_at) 
       VALUES (:id, :date, :description, NOW(), NOW())`,
      { replacements: { id: holidayId, date, description }, type: 'INSERT' }
    );

    // Fetch created holiday
    const holiday = await sequelize.query(
      `SELECT id, date, description, created_at FROM holidays WHERE id = :id`,
      { replacements: { id: holidayId }, type: 'SELECT' }
    );

    res.status(201).json({
      success: true,
      message: 'Holiday created successfully',
      data: (holiday as any[])[0]
    });

  } catch (error) {
    if (error instanceof yup.ValidationError) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    console.error('Create holiday error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ==================== 2. GET ALL HOLIDAYS ====================
export const getAllHolidays = async (req: Request, res: Response) => {
  try {
    const year = req.query.year as string;
    const month = req.query.month as string;
    
    let query = `SELECT id, date, description, created_at FROM holidays`;
    let replacements: any = {};
    
    if (year && month) {
      query += ` WHERE EXTRACT(YEAR FROM date) = :year AND EXTRACT(MONTH FROM date) = :month`;
      replacements = { year, month };
    } else if (year) {
      query += ` WHERE EXTRACT(YEAR FROM date) = :year`;
      replacements = { year };
    }
    
    query += ` ORDER BY date ASC`;

    const holidays = await sequelize.query(query, { 
      replacements, 
      type: 'SELECT' 
    });

    res.json({
      success: true,
      data: holidays
    });

  } catch (error) {
    console.error('Get holidays error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ==================== 3. GET HOLIDAY BY ID ====================
export const getHolidayById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const holidays = await sequelize.query(
      `SELECT id, date, description, created_at FROM holidays WHERE id = :id`,
      { replacements: { id }, type: 'SELECT' }
    );

    if ((holidays as any[]).length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Holiday not found'
      });
    }

    res.json({
      success: true,
      data: (holidays as any[])[0]
    });

  } catch (error) {
    console.error('Get holiday error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ==================== 4. UPDATE HOLIDAY ====================
export const updateHoliday = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { date, description } = req.body;

    if (!date && !description) {
      return res.status(400).json({
        success: false,
        message: 'Date or description is required'
      });
    }

    // Check if holiday exists
    const holidays = await sequelize.query(
      `SELECT id FROM holidays WHERE id = :id`,
      { replacements: { id }, type: 'SELECT' }
    );

    if ((holidays as any[]).length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Holiday not found'
      });
    }

    // If date is being updated, check if new date already has a holiday
    if (date) {
      const existingHoliday = await sequelize.query(
        `SELECT id FROM holidays WHERE date = :date AND id != :id`,
        { replacements: { date, id }, type: 'SELECT' }
      );

      if ((existingHoliday as any[]).length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Holiday already exists on this date'
        });
      }
    }

    // Build update query
    const updates = ['updated_at = NOW()'];
    const replacements: any = { id };

    if (date) {
      updates.push('date = :date');
      replacements.date = date;
    }
    if (description) {
      updates.push('description = :description');
      replacements.description = description;
    }

    // Update holiday
    await sequelize.query(
      `UPDATE holidays SET ${updates.join(', ')} WHERE id = :id`,
      { replacements, type: 'UPDATE' }
    );

    // Fetch updated holiday
    const updatedHoliday = await sequelize.query(
      `SELECT id, date, description, created_at FROM holidays WHERE id = :id`,
      { replacements: { id }, type: 'SELECT' }
    );

    res.json({
      success: true,
      message: 'Holiday updated successfully',
      data: (updatedHoliday as any[])[0]
    });

  } catch (error) {
    console.error('Update holiday error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ==================== 5. DELETE HOLIDAY ====================
export const deleteHoliday = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if holiday exists
    const holidays = await sequelize.query(
      `SELECT id FROM holidays WHERE id = :id`,
      { replacements: { id }, type: 'SELECT' }
    );

    if ((holidays as any[]).length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Holiday not found'
      });
    }

    // Delete holiday
    await sequelize.query(
      `DELETE FROM holidays WHERE id = :id`,
      { replacements: { id }, type: 'DELETE' }
    );

    res.json({
      success: true,
      message: 'Holiday deleted successfully'
    });

  } catch (error) {
    console.error('Delete holiday error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};