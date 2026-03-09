import { Request, Response } from 'express';
import sequelize from '../config/database';
import { generateIDCard } from '../services/pdf.service';

export const generateEmployeeIDCard = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Fetch employee details with department and designation names
    const employees = await sequelize.query(
      `SELECT 
        e.id,
        e.employee_code,
        e.first_name,
        e.last_name,
        e.date_of_birth,
        e.blood_group,
        e.email,
        e.aadhar_number,
        d.name as department_name,
        deg.name as designation_name
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id
       LEFT JOIN designations deg ON e.designation_id = deg.id
       WHERE e.id = :id`,
      { replacements: { id }, type: 'SELECT' }
    );

    if ((employees as any[]).length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    const employee = (employees as any[])[0];

    // Fetch employee photo
    const photos = await sequelize.query(
      `SELECT file_path FROM employee_documents 
       WHERE employee_id = :id AND document_type = 'employee_photo'`,
      { replacements: { id }, type: 'SELECT' }
    );

    let photoUrl = '';
    if ((photos as any[]).length > 0) {
      photoUrl = (photos as any[])[0].file_path;
    }

    // Add photo URL to employee object
    const employeeData = {
      ...employee,
      photo_url: photoUrl
    };

    // Generate PDF ID card
    await generateIDCard(employeeData, res);

  } catch (error) {
    console.error('Generate ID card error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};