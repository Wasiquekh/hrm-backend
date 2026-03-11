import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { PutObjectCommand } from "@aws-sdk/client-s3";
import s3Client, { BUCKET, BASE_URL } from '../config/s3';
import sequelize from '../config/database';
import EmployeeAttendance from '../models/EmployeeAttendance.model';
import multer from 'multer';
import * as yup from 'yup';

interface AuthRequest extends Request {
  user?: any;
}

// Multer config
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// 🔥 SIMPLE IST HELPER FUNCTIONS
const getISTDate = () => {
  const now = new Date();
  // YYYY-MM-DD format
  return now.toISOString().split('T')[0];
};

const getISTTimeForDB = () => {
  return new Date(); // Sequelize timezone +05:30 handles conversion
};

const formatISTForResponse = (date: Date | null) => {
  if (!date) return null;
  return date.toLocaleString('en-IN', { 
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).replace(/\//g, '-');
};

const formatHoursToReadable = (hours: number | null) => {
  if (!hours) return '0h 0m';
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${m}m`;
};

// ==================== PUNCH IN ====================
export const punchIn = async (req: AuthRequest, res: Response) => {
  upload.single('image')(req, res, async (err: any) => {
    if (err) {
      return res.status(400).json({ 
        success: false, 
        message: err.message 
      });
    }

    const transaction = await sequelize.transaction();
    
    try {
      if (!req.file) {
        await transaction.rollback();
        return res.status(400).json({ 
          success: false, 
          message: 'Image file is required' 
        });
      }

      const employee_id = req.user.id;
      const today = getISTDate();

      console.log('📍 Punch In - Employee:', employee_id, 'Date:', today);

      // Check existing
      const existing = await EmployeeAttendance.findOne({
        where: { employee_id, attendance_date: today },
        transaction
      });

      if (existing) {
        await transaction.rollback();
        return res.status(400).json({ 
          success: false, 
          message: 'Already punched in today' 
        });
      }

      // Upload to S3
      const file = req.file;
      const fileExtension = file.originalname.split('.').pop();
      const fileName = `attendance/${employee_id}/punch-in-${Date.now()}.${fileExtension}`;
      
      await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
      }));

      // Save in DB
      const attendance = await EmployeeAttendance.create({
        id: uuidv4(),
        employee_id,
        attendance_date: today,
        punch_in_time: getISTTimeForDB(),
        punch_in_image_url: `${BASE_URL}/${fileName}`,
      }, { transaction });

      await transaction.commit();
      
      res.json({ 
        success: true, 
        message: 'Punch in successful', 
        data: {
          id: attendance.id,
          date: attendance.attendance_date,
          punch_in_time: attendance.punch_in_time,
          punch_in_time_ist: formatISTForResponse(attendance.punch_in_time),
          // punch_in_image: attendance.punch_in_image_url
        }
      });

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Punch in error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Server error' 
      });
    }
  });
};

// ==================== PUNCH OUT ====================
export const punchOut = async (req: AuthRequest, res: Response) => {
  upload.single('image')(req, res, async (err: any) => {
    if (err) {
      return res.status(400).json({ 
        success: false, 
        message: err.message 
      });
    }

    const transaction = await sequelize.transaction();
    
    try {
      if (!req.file) {
        await transaction.rollback();
        return res.status(400).json({ 
          success: false, 
          message: 'Image file is required' 
        });
      }

      const employee_id = req.user.id;
      const today = getISTDate();

      console.log('📍 Punch Out - Employee:', employee_id, 'Date:', today);

      // Find today's record
      const attendance = await EmployeeAttendance.findOne({
        where: { employee_id, attendance_date: today },
        transaction
      });

      if (!attendance) {
        await transaction.rollback();
        return res.status(400).json({ 
          success: false, 
          message: 'Please punch in first' 
        });
      }

      if (attendance.punch_out_time) {
        await transaction.rollback();
        return res.status(400).json({ 
          success: false, 
          message: 'Already punched out today' 
        });
      }

      // Upload to S3
      const file = req.file;
      const fileExtension = file.originalname.split('.').pop();
      const fileName = `attendance/${employee_id}/punch-out-${Date.now()}.${fileExtension}`;
      
      await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
      }));

      // Update record
      attendance.punch_out_time = getISTTimeForDB();
      attendance.punch_out_image_url = `${BASE_URL}/${fileName}`;
      
      // 🔥 FIXED CALCULATION - 3 decimal places
      const punchInTime = attendance.punch_in_time!.getTime();
      const punchOutTime = attendance.punch_out_time.getTime();
      const diffMs = punchOutTime - punchInTime;
      const diffHours = diffMs / (1000 * 60 * 60);
      attendance.total_working_hours = Math.round(diffHours * 1000) / 1000;
      
      console.log('✅ Hours:', attendance.total_working_hours);
      
      await attendance.save({ transaction });
      await transaction.commit();
      
      res.json({ 
        success: true, 
        message: 'Punch out successful', 
        data: {
          id: attendance.id,
          date: attendance.attendance_date,
          punch_in_time: attendance.punch_in_time,
          punch_in_time_ist: formatISTForResponse(attendance.punch_in_time),
          punch_out_time: attendance.punch_out_time,
          punch_out_time_ist: formatISTForResponse(attendance.punch_out_time),
          total_hours: attendance.total_working_hours,
          total_hours_formatted: formatHoursToReadable(attendance.total_working_hours),
          // punch_in_image: attendance.punch_in_image_url,
          // punch_out_image: attendance.punch_out_image_url
        }
      });

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Punch out error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Server error' 
      });
    }
  });
};

// ==================== TODAY'S STATUS ====================
export const getTodayStatus = async (req: AuthRequest, res: Response) => {
  try {
    const employee_id = req.user.id;
    const today = getISTDate();

    const attendance = await EmployeeAttendance.findOne({
      where: { employee_id, attendance_date: today },
      attributes: [
        'id', 'attendance_date', 'punch_in_time', 'punch_out_time',
        'punch_in_image_url', 'punch_out_image_url', 'total_working_hours'
      ]
    });

    res.json({
      success: true,
      data: {
        date: today,
        punched_in: !!attendance?.punch_in_time,
        punched_out: !!attendance?.punch_out_time,
        punch_in_time: attendance?.punch_in_time,
        punch_in_time_ist: formatISTForResponse(attendance?.punch_in_time || null),
        punch_out_time: attendance?.punch_out_time,
        punch_out_time_ist: formatISTForResponse(attendance?.punch_out_time || null),
        total_hours: attendance?.total_working_hours || 0,
        total_hours_formatted: formatHoursToReadable(attendance?.total_working_hours || 0),
        punch_in_image: attendance?.punch_in_image_url,
        punch_out_image: attendance?.punch_out_image_url
      }
    });

  } catch (error) {
    console.error('❌ Status error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// ==================== MONTHLY ATTENDANCE ====================
export const getMonthlyAttendance = async (req: AuthRequest, res: Response) => {
  try {
    const employee_id = req.user.id;
    let { month, year } = req.query;

    // Default to current month
    if (!month || !year) {
      const today = new Date();
      month = (today.getMonth() + 1).toString();
      year = today.getFullYear().toString();
    }

    const monthNum = Number(month);
    const yearNum = Number(year);

    // Validate
    if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({ success: false, message: 'Invalid month' });
    }
    if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
      return res.status(400).json({ success: false, message: 'Invalid year' });
    }

    // Date range
    const lastDay = new Date(yearNum, monthNum, 0).getDate();
    const startDate = `${yearNum}-${String(monthNum).padStart(2, '0')}-01`;
    const endDate = `${yearNum}-${String(monthNum).padStart(2, '0')}-${lastDay}`;

    console.log(`📊 Fetching ${startDate} to ${endDate}`);

    // Get records
    const records = await EmployeeAttendance.findAll({
      where: {
        employee_id,
        attendance_date: { [Op.between]: [startDate, endDate] }
      },
      order: [['attendance_date', 'DESC']],
      attributes: [
        'attendance_date', 'punch_in_time', 'punch_out_time',
        'punch_in_image_url', 'punch_out_image_url', 'total_working_hours'
      ]
    });

    // Calculate summary
    const totalDays = records.length;
    const presentDays = records.filter(r => r.punch_out_time).length;
    const halfDays = records.filter(r => r.punch_in_time && !r.punch_out_time).length;
    
    let totalHours = 0;
    if (records.length > 0) {
      totalHours = records.reduce((sum, r) => sum + (Number(r.total_working_hours) || 0), 0);
    }
    totalHours = Math.round(totalHours * 1000) / 1000;

    // Format records
    const formattedRecords = records.map(record => ({
      attendance_date: record.attendance_date,
      punch_in_time: record.punch_in_time,
      punch_in_time_ist: formatISTForResponse(record.punch_in_time),
      punch_out_time: record.punch_out_time,
      punch_out_time_ist: formatISTForResponse(record.punch_out_time),
      total_hours: record.total_working_hours,
      total_hours_formatted: formatHoursToReadable(record.total_working_hours),
      punch_in_image: record.punch_in_image_url,
      punch_out_image: record.punch_out_image_url
    }));

    res.json({
      success: true,
      data: {
        month: monthNum,
        year: yearNum,
        summary: {
          total_days: totalDays,
          present: presentDays,
          half_day: halfDays,
          absent: totalDays - presentDays - halfDays,
          total_hours: totalHours,
          total_hours_formatted: formatHoursToReadable(totalHours)
        },
        records: formattedRecords
      }
    });

  } catch (error) {
    console.error('❌ Monthly attendance error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};