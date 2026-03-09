import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import sequelize from '../config/database';
import * as yup from 'yup';

// Validation Schema - Sirf required
const employeeLoginSchema = yup.object({
  first_name: yup.string()
    .required('First name is required'),
  
  employee_code: yup.string()
    .required('Employee code is required')
});

export const employeeLogin = async (req: Request, res: Response) => {
  try {
    // 1. Validate input
    await employeeLoginSchema.validate(req.body);
    
    const { first_name, employee_code } = req.body;

    // 2. Find employee with first_name and employee_code
    const employees = await sequelize.query(
      `SELECT 
        e.id,
        e.employee_code,
        e.first_name,
        e.last_name,
        CONCAT(e.first_name, ' ', e.last_name) as full_name,
        e.email,
        e.mobile,
        e.department_id,
        e.designation_id,
        e.date_of_joining,
        e.status,
        d.name as department_name,
        des.name as designation_name
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id
       LEFT JOIN designations des ON e.designation_id = des.id
       WHERE LOWER(e.first_name) = LOWER(:first_name) 
       AND e.employee_code = :employee_code`,
      { 
        replacements: { 
          first_name: first_name.trim(), 
          employee_code: employee_code.trim() 
        }, 
        type: 'SELECT' 
      }
    );

    // 3. Check if employee exists
    if (!employees || (employees as any[]).length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid first name or employee code' 
      });
    }

    const employee = (employees as any[])[0];

    // 4. Check if employee is active
    if (employee.status !== 'active') {
      return res.status(401).json({ 
        success: false, 
        message: 'Your account is not active. Please contact HR.' 
      });
    }

    // 5. Generate JWT Token
    const token = jwt.sign(
      { 
        id: employee.id,
        employee_code: employee.employee_code,
        first_name: employee.first_name,
        last_name: employee.last_name,
        email: employee.email,
        type: 'employee'
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '8h' } as jwt.SignOptions
    );

    // 6. Send response
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        employee: {
          id: employee.id,
          employee_code: employee.employee_code,
          first_name: employee.first_name,
          last_name: employee.last_name,
          full_name: employee.full_name,
          email: employee.email,
          mobile: employee.mobile,
          department_name: employee.department_name,
          designation_name: employee.designation_name,
          date_of_joining: employee.date_of_joining,
          status: employee.status
        }
      }
    });

  } catch (error) {
    if (error instanceof yup.ValidationError) {
      return res.status(400).json({ 
        success: false, 
        message: error.errors[0] 
      });
    }
    
    console.error('Employee login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error. Please try again later.' 
    });
  }
};