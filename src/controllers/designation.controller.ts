import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import sequelize from '../config/database';
import * as yup from 'yup';

// Validation Schema
const designationSchema = yup.object({
  name: yup.string().required('Designation name is required').min(2).max(100)
});

// ==================== 1. CREATE DESIGNATION ====================
export const createDesignation = async (req: Request, res: Response) => {
  try {
    await designationSchema.validate(req.body);
    
    const { name } = req.body;
    const designationId = uuidv4();

    // Check if designation already exists
    const existing = await sequelize.query(
      `SELECT id FROM designations WHERE name = :name`,
      { replacements: { name }, type: 'SELECT' }
    );

    if ((existing as any[]).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Designation already exists'
      });
    }

    // Insert designation
    await sequelize.query(
      `INSERT INTO designations (id, name, created_at, updated_at) 
       VALUES (:id, :name, NOW(), NOW())`,
      { replacements: { id: designationId, name }, type: 'INSERT' }
    );

    // Fetch created designation
    const designation = await sequelize.query(
      `SELECT id, name, created_at FROM designations WHERE id = :id`,
      { replacements: { id: designationId }, type: 'SELECT' }
    );

    res.status(201).json({
      success: true,
      message: 'Designation created successfully',
      data: (designation as any[])[0]
    });

  } catch (error) {
    if (error instanceof yup.ValidationError) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    console.error('Create designation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ==================== 2. GET ALL DESIGNATIONS ====================
export const getAllDesignations = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    const countResult = await sequelize.query(
      `SELECT COUNT(*) as total FROM designations`,
      { type: 'SELECT' }
    );
    const total = (countResult as any[])[0]?.total || 0;

    const designations = await sequelize.query(
      `SELECT id, name, created_at FROM designations 
       ORDER BY name ASC
       LIMIT :limit OFFSET :offset`,
      { replacements: { limit, offset }, type: 'SELECT' }
    );

    res.json({
      success: true,
      data: designations,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });

  } catch (error) {
    console.error('Get designations error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ==================== 3. GET DESIGNATION BY ID ====================
export const getDesignationById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const designations = await sequelize.query(
      `SELECT id, name, created_at FROM designations WHERE id = :id`,
      { replacements: { id }, type: 'SELECT' }
    );

    if ((designations as any[]).length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Designation not found'
      });
    }

    res.json({
      success: true,
      data: (designations as any[])[0]
    });

  } catch (error) {
    console.error('Get designation error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ==================== 4. UPDATE DESIGNATION ====================
export const updateDesignation = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Designation name is required'
      });
    }

    // Check if designation exists
    const designations = await sequelize.query(
      `SELECT id FROM designations WHERE id = :id`,
      { replacements: { id }, type: 'SELECT' }
    );

    if ((designations as any[]).length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Designation not found'
      });
    }

    // Check if name already exists for another designation
    const existing = await sequelize.query(
      `SELECT id FROM designations WHERE name = :name AND id != :id`,
      { replacements: { name, id }, type: 'SELECT' }
    );

    if ((existing as any[]).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Designation name already exists'
      });
    }

    // Update designation
    await sequelize.query(
      `UPDATE designations SET name = :name, updated_at = NOW() WHERE id = :id`,
      { replacements: { name, id }, type: 'UPDATE' }
    );

    // Fetch updated designation
    const updated = await sequelize.query(
      `SELECT id, name, created_at FROM designations WHERE id = :id`,
      { replacements: { id }, type: 'SELECT' }
    );

    res.json({
      success: true,
      message: 'Designation updated successfully',
      data: (updated as any[])[0]
    });

  } catch (error) {
    console.error('Update designation error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ==================== 5. DELETE DESIGNATION ====================
export const deleteDesignation = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if designation exists
    const designations = await sequelize.query(
      `SELECT id, name FROM designations WHERE id = :id`,
      { replacements: { id }, type: 'SELECT' }
    );

    if ((designations as any[]).length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Designation not found'
      });
    }

    const designation = (designations as any[])[0];

    // Check if designation is used by any employee
    const employees = await sequelize.query(
      `SELECT id FROM employees WHERE designation = :deptName LIMIT 1`,
      { replacements: { deptName: designation.name }, type: 'SELECT' }
    );

    if ((employees as any[]).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete designation assigned to employees'
      });
    }

    // Delete designation
    await sequelize.query(
      `DELETE FROM designations WHERE id = :id`,
      { replacements: { id }, type: 'DELETE' }
    );

    res.json({
      success: true,
      message: 'Designation deleted successfully'
    });

  } catch (error) {
    console.error('Delete designation error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};