import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import sequelize from '../config/database';
import * as yup from 'yup';

// Validation Schema
const departmentSchema = yup.object({
  name: yup.string().required('Department name is required').min(2).max(100)
});

// ==================== 1. CREATE DEPARTMENT ====================
export const createDepartment = async (req: Request, res: Response) => {
  try {
    await departmentSchema.validate(req.body);
    
    const { name } = req.body;
    const departmentId = uuidv4();

    // Check if department already exists
    const existingDept = await sequelize.query(
      `SELECT id FROM departments WHERE name = :name`,
      { replacements: { name }, type: 'SELECT' }
    );

    if ((existingDept as any[]).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Department already exists'
      });
    }

    // Insert department
    await sequelize.query(
      `INSERT INTO departments (id, name, created_at, updated_at) 
       VALUES (:id, :name, NOW(), NOW())`,
      { replacements: { id: departmentId, name }, type: 'INSERT' }
    );

    // Fetch created department
    const department = await sequelize.query(
      `SELECT id, name, created_at FROM departments WHERE id = :id`,
      { replacements: { id: departmentId }, type: 'SELECT' }
    );

    res.status(201).json({
      success: true,
      message: 'Department created successfully',
      data: (department as any[])[0]
    });

  } catch (error) {
    if (error instanceof yup.ValidationError) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    console.error('Create department error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ==================== 2. GET ALL DEPARTMENTS ====================
export const getAllDepartments = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    const countResult = await sequelize.query(
      `SELECT COUNT(*) as total FROM departments`,
      { type: 'SELECT' }
    );
    const total = (countResult as any[])[0]?.total || 0;

    const departments = await sequelize.query(
      `SELECT id, name, created_at FROM departments 
       ORDER BY name ASC
       LIMIT :limit OFFSET :offset`,
      { replacements: { limit, offset }, type: 'SELECT' }
    );

    res.json({
      success: true,
      data: departments,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });

  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ==================== 3. GET DEPARTMENT BY ID ====================
export const getDepartmentById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const departments = await sequelize.query(
      `SELECT id, name, created_at FROM departments WHERE id = :id`,
      { replacements: { id }, type: 'SELECT' }
    );

    if ((departments as any[]).length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    res.json({
      success: true,
      data: (departments as any[])[0]
    });

  } catch (error) {
    console.error('Get department error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ==================== 4. UPDATE DEPARTMENT ====================
export const updateDepartment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Department name is required'
      });
    }

    // Check if department exists
    const departments = await sequelize.query(
      `SELECT id FROM departments WHERE id = :id`,
      { replacements: { id }, type: 'SELECT' }
    );

    if ((departments as any[]).length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    // Check if name already exists for another department
    const existingDept = await sequelize.query(
      `SELECT id FROM departments WHERE name = :name AND id != :id`,
      { replacements: { name, id }, type: 'SELECT' }
    );

    if ((existingDept as any[]).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Department name already exists'
      });
    }

    // Update department
    await sequelize.query(
      `UPDATE departments SET name = :name, updated_at = NOW() WHERE id = :id`,
      { replacements: { name, id }, type: 'UPDATE' }
    );

    // Fetch updated department
    const updatedDept = await sequelize.query(
      `SELECT id, name, created_at FROM departments WHERE id = :id`,
      { replacements: { id }, type: 'SELECT' }
    );

    res.json({
      success: true,
      message: 'Department updated successfully',
      data: (updatedDept as any[])[0]
    });

  } catch (error) {
    console.error('Update department error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ==================== 5. DELETE DEPARTMENT ====================
export const deleteDepartment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if department exists
    const departments = await sequelize.query(
      `SELECT id, name FROM departments WHERE id = :id`,
      { replacements: { id }, type: 'SELECT' }
    );

    if ((departments as any[]).length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    const department = (departments as any[])[0];

    // Check if department is used by any employee - FIXED: use department_id
    const employees = await sequelize.query(
      `SELECT id FROM employees WHERE department_id = :deptId LIMIT 1`,
      { replacements: { deptId: id }, type: 'SELECT' }
    );

    if ((employees as any[]).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete department assigned to employees'
      });
    }

    // Delete department
    await sequelize.query(
      `DELETE FROM departments WHERE id = :id`,
      { replacements: { id }, type: 'DELETE' }
    );

    res.json({
      success: true,
      message: 'Department deleted successfully'
    });

  } catch (error) {
    console.error('Delete department error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};