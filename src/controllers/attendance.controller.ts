import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import sequelize from '../config/database';
import * as yup from 'yup';
import { Op } from 'sequelize';

// Validation Schema
const attendanceSchema = yup.object({
  employee_id: yup.string().uuid('Invalid employee ID').required('Employee ID is required'),
  date: yup.date().required('Date is required'),
  status: yup.string()
    .required('Status is required')
    .oneOf(['P', 'A', 'PL', 'HD', 'L', 'H', 'SL', 'OT'], 'Invalid status'),
});

const bulkAttendanceSchema = yup.object({
  attendances: yup.array().of(
    yup.object({
      employee_id: yup.string().uuid().required(),
      date: yup.date().required(),
      status: yup.string().oneOf(['P', 'A', 'PL', 'HD', 'L', 'H', 'SL', 'OT']).required(),
    })
  ).required().min(1),
});

// Status meanings for response
const statusMeanings = {
  'P': 'Present',
  'A': 'Absent',
  'PL': 'Paid Leave',
  'HD': 'Half Day',
  'L': 'Leave',
  'H': 'Holiday',
  'SL': 'Sick Leave',
  'OT': 'Overtime',
};

// ==================== 1. MARK ATTENDANCE (Single) ====================
export const markAttendance = async (req: Request, res: Response) => {
  try {
    await attendanceSchema.validate(req.body);
    
    const { employee_id, date, status } = req.body;
    const attendanceId = uuidv4();

    // Check if employee exists
    const employee = await sequelize.query(
      `SELECT id FROM employees WHERE id = :employee_id`,
      { replacements: { employee_id }, type: 'SELECT' }
    );

    if ((employee as any[]).length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Check if attendance already marked for this date
    const existingAttendance = await sequelize.query(
      `SELECT id FROM attendances WHERE employee_id = :employee_id AND date = :date`,
      { replacements: { employee_id, date }, type: 'SELECT' }
    );

    if ((existingAttendance as any[]).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Attendance already marked for this date'
      });
    }

    // Insert attendance
    await sequelize.query(
      `INSERT INTO attendances (id, employee_id, date, status, created_at, updated_at)
       VALUES (:id, :employee_id, :date, :status, NOW(), NOW())`,
      {
        replacements: { 
          id: attendanceId, 
          employee_id, 
          date, 
          status 
        },
        type: 'INSERT'
      }
    );

    // Fetch created attendance with employee details
    const attendance = await sequelize.query(
      `SELECT a.*, e.first_name, e.last_name, e.employee_code
       FROM attendances a
       JOIN employees e ON a.employee_id = e.id
       WHERE a.id = :id`,
      { replacements: { id: attendanceId }, type: 'SELECT' }
    );

    const result = (attendance as any[])[0];
    result.status_text = statusMeanings[result.status as keyof typeof statusMeanings];

    res.status(201).json({
      success: true,
      message: 'Attendance marked successfully',
      data: result
    });

  } catch (error) {
    if (error instanceof yup.ValidationError) {
      return res.status(400).json({
        success: false,
        message: error.errors[0]
      });
    }
    console.error('Mark attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ==================== 2. BULK ATTENDANCE MARKING ====================
export const bulkMarkAttendance = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  
  try {
    await bulkAttendanceSchema.validate(req.body);
    
    const { attendances } = req.body;
    const results = [];
    const errors = [];

    for (const att of attendances) {
      try {
        // Check if employee exists
        const employee = await sequelize.query(
          `SELECT id, first_name, last_name, employee_code FROM employees WHERE id = :employee_id`,
          { replacements: { employee_id: att.employee_id }, type: 'SELECT', transaction }
        );

        if ((employee as any[]).length === 0) {
          errors.push(`Employee ${att.employee_id} not found`);
          continue;
        }

        // Check for duplicate
        const existing = await sequelize.query(
          `SELECT id FROM attendances WHERE employee_id = :employee_id AND date = :date`,
          { replacements: { employee_id: att.employee_id, date: att.date }, type: 'SELECT', transaction }
        );

        if ((existing as any[]).length > 0) {
          errors.push(`Attendance already exists for employee ${att.employee_id} on ${att.date}`);
          continue;
        }

        const attendanceId = uuidv4();

        // Insert
        await sequelize.query(
          `INSERT INTO attendances (id, employee_id, date, status, created_at, updated_at)
           VALUES (:id, :employee_id, :date, :status, NOW(), NOW())`,
          {
            replacements: { 
              id: attendanceId, 
              employee_id: att.employee_id, 
              date: att.date, 
              status: att.status 
            },
            type: 'INSERT',
            transaction
          }
        );

        results.push({
          id: attendanceId,
          employee_id: att.employee_id,
          date: att.date,
          status: att.status,
          status_text: statusMeanings[att.status as keyof typeof statusMeanings],
          employee_name: (employee as any[])[0].first_name + ' ' + (employee as any[])[0].last_name
        });

      } catch (err) {
        errors.push(`Error processing ${att.employee_id}: ${err}`);
      }
    }

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: `Marked ${results.length} attendances successfully`,
      data: {
        successful: results,
        failed: errors,
        total_processed: attendances.length,
        success_count: results.length,
        error_count: errors.length
      }
    });

  } catch (error) {
    await transaction.rollback();
    
    if (error instanceof yup.ValidationError) {
      return res.status(400).json({
        success: false,
        message: error.errors[0]
      });
    }
    console.error('Bulk attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ==================== 3. GET ATTENDANCE BY DATE RANGE ====================
export const getAttendanceByDateRange = async (req: Request, res: Response) => {
  try {
    const { start_date, end_date, employee_id } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    let query = `
      SELECT a.*, e.first_name, e.last_name, e.employee_code
      FROM attendances a
      JOIN employees e ON a.employee_id = e.id
      WHERE a.date BETWEEN :start_date AND :end_date
    `;
    let replacements: any = { start_date, end_date };

    if (employee_id) {
      query += ` AND a.employee_id = :employee_id`;
      replacements.employee_id = employee_id;
    }

    query += ` ORDER BY a.date DESC, e.first_name ASC`;

    const attendances = await sequelize.query(query, {
      replacements,
      type: 'SELECT'
    });

    // Add status text
    const results = (attendances as any[]).map(att => ({
      ...att,
      status_text: statusMeanings[att.status as keyof typeof statusMeanings]
    }));

    // Calculate summary
    const summary = {
      total: results.length,
      present: results.filter(a => a.status === 'P').length,
      absent: results.filter(a => a.status === 'A').length,
      leave: results.filter(a => ['PL', 'L', 'SL'].includes(a.status)).length,
      holiday: results.filter(a => a.status === 'H').length,
      half_day: results.filter(a => a.status === 'HD').length,
      overtime: results.filter(a => a.status === 'OT').length,
    };

    res.json({
      success: true,
      data: results,
      summary
    });

  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ==================== 4. GET ATTENDANCE BY MONTH ====================
export const getAttendanceByMonth = async (req: Request, res: Response) => {
  try {
    const { year, month, employee_id } = req.query;

    if (!year || !month) {
      return res.status(400).json({
        success: false,
        message: 'Year and month are required'
      });
    }

    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    
    // Calculate last day of month
    const lastDay = new Date(Number(year), Number(month), 0).getDate();
    const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay}`;

    let query = `
      SELECT a.*, e.first_name, e.last_name, e.employee_code
      FROM attendances a
      JOIN employees e ON a.employee_id = e.id
      WHERE a.date BETWEEN :start_date AND :end_date
    `;
    let replacements: any = { start_date: startDate, end_date: endDate };

    if (employee_id) {
      query += ` AND a.employee_id = :employee_id`;
      replacements.employee_id = employee_id;
    }

    query += ` ORDER BY a.date ASC`;

    const attendances = await sequelize.query(query, {
      replacements,
      type: 'SELECT'
    });

    // Group by date for easy frontend consumption
    const groupedByDate: any = {};
    (attendances as any[]).forEach(att => {
      if (!groupedByDate[att.date]) {
        groupedByDate[att.date] = [];
      }
      groupedByDate[att.date].push({
        ...att,
        status_text: statusMeanings[att.status as keyof typeof statusMeanings]
      });
    });

    res.json({
      success: true,
      data: groupedByDate,
      meta: {
        year,
        month,
        total_records: attendances.length,
        dates: Object.keys(groupedByDate)
      }
    });

  } catch (error) {
    console.error('Get monthly attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ==================== 5. UPDATE ATTENDANCE ====================
export const updateAttendance = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    if (!['P', 'A', 'PL', 'HD', 'L', 'H', 'SL', 'OT'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    // Check if attendance exists
    const attendances = await sequelize.query(
      `SELECT a.*, e.first_name, e.last_name, e.employee_code
       FROM attendances a
       JOIN employees e ON a.employee_id = e.id
       WHERE a.id = :id`,
      { replacements: { id }, type: 'SELECT' }
    );

    if ((attendances as any[]).length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found'
      });
    }

    // Update status
    await sequelize.query(
      `UPDATE attendances SET status = :status, updated_at = NOW() WHERE id = :id`,
      { replacements: { status, id }, type: 'UPDATE' }
    );

    // Fetch updated record
    const updated = await sequelize.query(
      `SELECT a.*, e.first_name, e.last_name, e.employee_code
       FROM attendances a
       JOIN employees e ON a.employee_id = e.id
       WHERE a.id = :id`,
      { replacements: { id }, type: 'SELECT' }
    );

    const result = (updated as any[])[0];
    result.status_text = statusMeanings[result.status as keyof typeof statusMeanings];

    res.json({
      success: true,
      message: 'Attendance updated successfully',
      data: result
    });

  } catch (error) {
    console.error('Update attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ==================== 6. DELETE ATTENDANCE ====================
export const deleteAttendance = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if exists
    const attendances = await sequelize.query(
      `SELECT id FROM attendances WHERE id = :id`,
      { replacements: { id }, type: 'SELECT' }
    );

    if ((attendances as any[]).length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found'
      });
    }

    // Delete
    await sequelize.query(
      `DELETE FROM attendances WHERE id = :id`,
      { replacements: { id }, type: 'DELETE' }
    );

    res.json({
      success: true,
      message: 'Attendance record deleted successfully'
    });

  } catch (error) {
    console.error('Delete attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ==================== 7. GET EMPLOYEE ATTENDANCE SUMMARY ====================
export const getEmployeeAttendanceSummary = async (req: Request, res: Response) => {
  try {
    const { employee_id, year, month } = req.query;

    if (!employee_id || !year || !month) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID, year and month are required'
      });
    }

    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const lastDay = new Date(Number(year), Number(month), 0).getDate();
    const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay}`;

    const attendances = await sequelize.query(
      `SELECT date, status FROM attendances 
       WHERE employee_id = :employee_id AND date BETWEEN :start_date AND :end_date
       ORDER BY date ASC`,
      {
        replacements: { employee_id, start_date: startDate, end_date: endDate },
        type: 'SELECT'
      }
    );

    const summary = {
      present: 0,
      absent: 0,
      leave: 0,
      holiday: 0,
      half_day: 0,
      overtime: 0,
      total_days: 0,
      details: attendances
    };

    (attendances as any[]).forEach(att => {
      summary.total_days++;
      switch(att.status) {
        case 'P': summary.present++; break;
        case 'A': summary.absent++; break;
        case 'PL': case 'L': case 'SL': summary.leave++; break;
        case 'H': summary.holiday++; break;
        case 'HD': summary.half_day++; break;
        case 'OT': summary.overtime++; break;
      }
    });

    res.json({
      success: true,
      data: summary
    });

  } catch (error) {
    console.error('Get attendance summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};