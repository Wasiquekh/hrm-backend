import { Router } from 'express';
import { createUser, getAllUsers, getUserById, updateUser, deleteUser,resetTotpSecret  } from '../controllers/systemUser.controller';
import { login } from '../controllers/auth.controller';
import { generateQR, verifyTOTP } from '../controllers/totp.controller';
import {
  createEmployee,
  getAllEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
  updateEmployeeStatus  
} from '../controllers/employee.controller';
import {
  createDepartment,
  getAllDepartments,
  getDepartmentById,
  updateDepartment,
  deleteDepartment
} from '../controllers/department.controller';
import {
  createDesignation,
  getAllDesignations,
  getDesignationById,
  updateDesignation,
  deleteDesignation
} from '../controllers/designation.controller';
import { authenticate } from '../middleware/auth.middleware';  // 👈 Import auth middleware
import { generateEmployeeIDCard } from '../controllers/idCard.controller';
import {
  createHoliday,
  getAllHolidays,
  getHolidayById,
  updateHoliday,
  deleteHoliday
} from '../controllers/holiday.controller';

import {
  markAttendance,
  bulkMarkAttendance,
  getAttendanceByDateRange,
  getAttendanceByMonth,
  updateAttendance,
  deleteAttendance,
  getEmployeeAttendanceSummary
} from '../controllers/attendance.controller';
import { employeeLogin } from '../controllers/employeeLogin.controller';

import { 
  punchIn, 
  punchOut, 
  getTodayStatus, 
  getMonthlyAttendance,
} from '../controllers/employeeAttendance.controller';


const router = Router();

// ========== PUBLIC ROUTES (No Token Required) ==========
router.post('/login', login);                    // POST /api/login
router.post('/generate-qr', generateQR);          // POST /api/generate-qr
router.post('/verify-totp', verifyTOTP);          // POST /api/verify-totp
router.post('/employee/login', employeeLogin);

// ========== APPLY AUTH MIDDLEWARE TO ALL ROUTES BELOW ==========
router.use(authenticate);  // 👈 1 LINE MEIN SAB PROTECTED

// ========== PROTECTED USER ROUTES ==========
router.post('/users', createUser);                // POST /api/users
router.get('/users', getAllUsers);                 // GET /api/users
router.get('/users/:id', getUserById);             // GET /api/users/:id
router.put('/users/:id', updateUser);              // PUT /api/users/:id
router.delete('/users/:id', deleteUser);           // DELETE /api/users/:id
router.post('/users/:id/reset-totp', resetTotpSecret);  // POST /api/users/:id/reset-totp

// ========== PROTECTED EMPLOYEE ROUTES ==========
router.post('/employees', createEmployee);         // POST /api/employees
router.get('/employees', getAllEmployees);          // GET /api/employees
router.get('/employees/:id', getEmployeeById);      // GET /api/employees/:id
router.put('/employees/:id', updateEmployee);       // PUT /api/employees/:id
router.delete('/employees/:id', deleteEmployee);    // DELETE /api/employees/:id
router.post('/employees/status', updateEmployeeStatus); // POST /api/employees/status

// ========== PROTECTED DEPARTMENT ROUTES ==========
router.post('/departments', createDepartment);      // POST /api/departments
router.get('/departments', getAllDepartments);       // GET /api/departments
router.get('/departments/:id', getDepartmentById);   // GET /api/departments/:id
router.put('/departments/:id', updateDepartment);    // PUT /api/departments/:id
router.delete('/departments/:id', deleteDepartment); // DELETE /api/departments/:id

// ========== PROTECTED DESIGNATION ROUTES ==========
router.post('/designations', createDesignation);      // POST /api/designations
router.get('/designations', getAllDesignations);       // GET /api/designations
router.get('/designations/:id', getDesignationById);   // GET /api/designations/:id
router.put('/designations/:id', updateDesignation);    // PUT /api/designations/:id
router.delete('/designations/:id', deleteDesignation); // DELETE /api/designations/:id

// ========== PROTECTED ID CARD ROUTES ==========
router.get('/employees/:id/card', generateEmployeeIDCard);  // GET /api/employees/:id/card

// ========== HOLIDAY ROUTES ==========
router.post('/holidays', createHoliday);           // POST /api/holidays
router.get('/holidays', getAllHolidays);            // GET /api/holidays
router.get('/holidays/:id', getHolidayById);        // GET /api/holidays/:id
router.put('/holidays/:id', updateHoliday);         // PUT /api/holidays/:id
router.delete('/holidays/:id', deleteHoliday);      // DELETE /api/holidays/:id

router.post('/attendance', markAttendance);                    // POST /api/attendance
router.post('/attendance/bulk', bulkMarkAttendance);            // POST /api/attendance/bulk
router.get('/attendance/range', getAttendanceByDateRange);      // GET /api/attendance/range?start_date=2024-01-01&end_date=2024-01-31
router.get('/attendance/month', getAttendanceByMonth);          // GET /api/attendance/month?year=2024&month=1
router.get('/attendance/summary', getEmployeeAttendanceSummary); // GET /api/attendance/summary?employee_id=uuid&year=2024&month=1
router.put('/attendance/:id', updateAttendance);                // PUT /api/attendance/:id
router.delete('/attendance/:id', deleteAttendance);             // DELETE /api/attendance/:id

// Employee Attendance Routes
router.post('/employee/punch-in', punchIn);
router.post('/employee/punch-out', punchOut);
router.get('/employee/today-status', getTodayStatus);
router.get('/employee/monthly-attendance', getMonthlyAttendance);



export default router;