import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import s3Client, { BUCKET, BASE_URL } from '../config/s3';
import sequelize from '../config/database';
import * as yup from 'yup';
import multer from 'multer';

// Multer config
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
});

// ==================== VALIDATION SCHEMAS ====================

// Create Validation Schema
const createEmployeeSchema = yup.object({
  first_name: yup.string().required('First name is required'),
  last_name: yup.string().required('Last name is required'),
  date_of_birth: yup.date().required('Date of birth is required'),
  gender: yup.string().required('Gender is required'),
  marital_status: yup.string().required('Marital status is required'),
  email: yup.string().required('Email is required').email(),
  mobile: yup.string().required('Mobile is required').matches(/^[0-9]{10}$/, '10 digits required'),
  alternate_mobile: yup.string().matches(/^[0-9]{10}$/, '10 digits required').nullable(),
  address: yup.string().required('Address is required'),
  city: yup.string().required('City is required'),
  state: yup.string().required('State is required'),
  blood_group: yup.string().nullable(),
  qualification: yup.string().nullable(),
  department_id: yup.string().uuid('Invalid department ID format').nullable(),  // 👈 Changed
  designation_id: yup.string().uuid('Invalid designation ID format').nullable(), // 👈 Changed
  date_of_joining: yup.date().required('Date of joining is required'),
  salary: yup.number().required('Salary is required').min(0),
  overtime_per_day: yup.number().required('Overtime is required').min(0),
  travel_allowance: yup.number().required('Travel allowance is required').min(0),
  account_number: yup.string().required('Account number is required'),
  bank_name: yup.string().required('Bank name is required'),
  ifsc_code: yup.string().required('IFSC code is required'),
  branch_name: yup.string().required('Branch name is required'),
  pan_number: yup.string().required('PAN number is required'),
  aadhar_number: yup.string().required('Aadhar number is required').matches(/^[0-9]{12}$/, '12 digits required'),
});

// Update Validation Schema
const updateEmployeeSchema = yup.object({
  first_name: yup.string().optional(),
  last_name: yup.string().optional(),
  date_of_birth: yup.date().optional(),
  gender: yup.string().optional(),
  marital_status: yup.string().optional(),
  email: yup.string().email().optional(),
  mobile: yup.string().matches(/^[0-9]{10}$/, '10 digits required').optional(),
  alternate_mobile: yup.string().matches(/^[0-9]{10}$/, '10 digits required').nullable().optional(),
  address: yup.string().optional(),
  city: yup.string().optional(),
  state: yup.string().optional(),
  blood_group: yup.string().nullable().optional(),
  qualification: yup.string().nullable().optional(),
  department_id: yup.string().uuid('Invalid department ID format').nullable().optional(),  // 👈 Changed
  designation_id: yup.string().uuid('Invalid designation ID format').nullable().optional(), // 👈 Changed
  date_of_joining: yup.date().optional(),
  salary: yup.number().min(0).optional(),
  overtime_per_day: yup.number().min(0).optional(),
  travel_allowance: yup.number().min(0).optional(),
  account_number: yup.string().optional(),
  bank_name: yup.string().optional(),
  ifsc_code: yup.string().optional(),
  branch_name: yup.string().optional(),
  pan_number: yup.string().optional(),
  aadhar_number: yup.string().matches(/^[0-9]{12}$/, '12 digits required').optional(),
});

// ==================== 1. CREATE EMPLOYEE ====================
export const createEmployee = async (req: Request, res: Response) => {
  try {
    upload.fields([
      { name: 'employee_photo', maxCount: 1 },
      { name: 'pan_card', maxCount: 1 },
      { name: 'cv', maxCount: 1 },
      { name: 'bank_details', maxCount: 1 },
      { name: 'aadhar_card', maxCount: 1 },
      { name: 'degree_certificate', maxCount: 1 },
      { name: 'light_bill', maxCount: 1 }
    ])(req, res, async (err: any) => {
      if (err) {
        return res.status(400).json({ 
          success: false, 
          message: err.message 
        });
      }

      const transaction = await sequelize.transaction();
      
      try {
        // Validate body
        await createEmployeeSchema.validate(req.body, { abortEarly: false });
        
        // 📌 CHECK REQUIRED DOCUMENTS
        const requiredDocuments = [
          'employee_photo', 
          'pan_card', 
          'cv', 
          'bank_details', 
          'aadhar_card', 
          'degree_certificate', 
          'light_bill'
        ];
        
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        const missingDocuments = requiredDocuments.filter(doc => !files[doc] || files[doc].length === 0);

        if (missingDocuments.length > 0) {
          await transaction.rollback();
          return res.status(400).json({
            success: false,
            message: `Missing required documents: ${missingDocuments.join(', ')}`
          });
        }
        
        const employeeData = req.body;
        const employeeId = uuidv4();

        // 🔍 CHECK FOR DUPLICATES
        const existingEmployee = await sequelize.query(
          `SELECT id, email, mobile, account_number, pan_number, aadhar_number 
           FROM employees 
           WHERE email = :email 
              OR mobile = :mobile 
              OR account_number = :account_number
              OR pan_number = :pan_number
              OR aadhar_number = :aadhar_number`,
          {
            replacements: {
              email: employeeData.email,
              mobile: employeeData.mobile,
              account_number: employeeData.account_number,
              pan_number: employeeData.pan_number,
              aadhar_number: employeeData.aadhar_number
            },
            type: 'SELECT',
            transaction
          }
        );

        if ((existingEmployee as any[]).length > 0) {
          await transaction.rollback();
          const duplicate = (existingEmployee as any[])[0];
          
          let duplicateField = '';
          if (duplicate.email === employeeData.email) duplicateField = 'Email';
          else if (duplicate.mobile === employeeData.mobile) duplicateField = 'Mobile';
          else if (duplicate.account_number === employeeData.account_number) duplicateField = 'Account number';
          else if (duplicate.pan_number === employeeData.pan_number) duplicateField = 'PAN number';
          else if (duplicate.aadhar_number === employeeData.aadhar_number) duplicateField = 'Aadhar number';
          
          return res.status(400).json({
            success: false,
            message: `${duplicateField} already exists`
          });
        }

        // Insert employee - 👈 UPDATED with department_id and designation_id
        await sequelize.query(
          `INSERT INTO employees (
            id, first_name, last_name, date_of_birth, gender, marital_status, email, mobile,
            alternate_mobile, address, city, state, blood_group, qualification,
            department_id, designation_id, date_of_joining, salary, overtime_per_day, travel_allowance,
            account_number, bank_name, ifsc_code, branch_name, pan_number, aadhar_number,
            created_at, updated_at, status
          ) VALUES (
            :id, :first_name, :last_name, :date_of_birth, :gender, :marital_status, :email, :mobile,
            :alternate_mobile, :address, :city, :state, :blood_group, :qualification,
            :department_id, :designation_id, :date_of_joining, :salary, :overtime_per_day, :travel_allowance,
            :account_number, :bank_name, :ifsc_code, :branch_name, :pan_number, :aadhar_number,
            NOW(), NOW(), 'active'
          )`,
          {
            replacements: { 
              id: employeeId, 
              ...employeeData,
              department_id: employeeData.department_id || null,
              designation_id: employeeData.designation_id || null
            },
            type: 'INSERT',
            transaction
          }
        );

        // Upload documents
        const documentTypes = [
          'employee_photo', 'pan_card', 'cv', 'bank_details',
          'aadhar_card', 'degree_certificate', 'light_bill'
        ];

        for (const docType of documentTypes) {
          const fileList = files[docType];
          if (fileList && fileList.length > 0) {
            const file = fileList[0];
            
            const key = `employees/${employeeId}/${docType}/${Date.now()}-${file.originalname}`;
            
            const command = new PutObjectCommand({
              Bucket: BUCKET,
              Key: key,
              Body: file.buffer,
              ContentType: file.mimetype,
            });

            await s3Client.send(command);
            
            const fileUrl = `${BASE_URL}/${key}`;

            await sequelize.query(
              `INSERT INTO employee_documents 
               (id, employee_id, document_type, file_path, file_name, file_type, file_size, uploaded_at)
               VALUES 
               (:id, :employee_id, :document_type, :file_path, :file_name, :file_type, :file_size, NOW())`,
              {
                replacements: {
                  id: uuidv4(),
                  employee_id: employeeId,
                  document_type: docType,
                  file_path: fileUrl,
                  file_name: file.originalname,
                  file_type: file.mimetype,
                  file_size: file.size
                },
                type: 'INSERT',
                transaction
              }
            );
          }
        }

        await transaction.commit();

        // Get employee with department and designation names - 👈 UPDATED
        const employee = await sequelize.query(
          `SELECT e.*, d.name as department_name, deg.name as designation_name
           FROM employees e
           LEFT JOIN departments d ON e.department_id = d.id
           LEFT JOIN designations deg ON e.designation_id = deg.id
           WHERE e.id = :id`,
          { replacements: { id: employeeId }, type: 'SELECT' }
        );

        const documents = await sequelize.query(
          `SELECT document_type, file_path, file_name FROM employee_documents WHERE employee_id = :id`,
          { replacements: { id: employeeId }, type: 'SELECT' }
        );

        res.status(201).json({
          success: true,
          message: 'Employee created successfully',
          data: {
            employee: (employee as any[])[0],
            documents
          }
        });

      } catch (error) {
        await transaction.rollback();
        
        if (error instanceof yup.ValidationError) {
          return res.status(400).json({ 
            success: false, 
            message: 'Validation failed',
            errors: error.errors 
          });
        }
        
        console.error('Create employee error:', error);
        res.status(500).json({ 
          success: false, 
          message: 'Server error' 
        });
      }
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// ==================== 2. GET ALL EMPLOYEES ====================
export const getAllEmployees = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    // Get total count
    const countResult = await sequelize.query(
      `SELECT COUNT(*) as total FROM employees`,
      { type: 'SELECT' }
    );
    const total = (countResult as any[])[0]?.total || 0;

    // Get employees with department and designation names - 👈 UPDATED
    const employees = await sequelize.query(
      `SELECT e.*, d.name as department_name, deg.name as designation_name
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id
       LEFT JOIN designations deg ON e.designation_id = deg.id
       ORDER BY e.created_at DESC
       LIMIT :limit OFFSET :offset`,
      { replacements: { limit, offset }, type: 'SELECT' }
    );

    // Get documents for each employee
    const employeesWithDocs = await Promise.all(
      (employees as any[]).map(async (emp) => {
        const documents = await sequelize.query(
          `SELECT document_type, file_path, file_name, file_type, file_size, uploaded_at 
           FROM employee_documents 
           WHERE employee_id = :id
           ORDER BY document_type`,
          { replacements: { id: emp.id }, type: 'SELECT' }
        );
        return { ...emp, documents };
      })
    );

    res.json({
      success: true,
      data: employeesWithDocs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get all employees error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// ==================== 3. GET EMPLOYEE BY ID ====================
export const getEmployeeById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get employee with department and designation names - 👈 UPDATED
    const employees = await sequelize.query(
      `SELECT e.*, d.name as department_name, deg.name as designation_name
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

    const documents = await sequelize.query(
      `SELECT document_type, file_path, file_name, file_type, file_size, uploaded_at 
       FROM employee_documents 
       WHERE employee_id = :id
       ORDER BY document_type`,
      { replacements: { id }, type: 'SELECT' }
    );

    res.json({
      success: true,
      data: {
        employee: (employees as any[])[0],
        documents
      }
    });

  } catch (error) {
    console.error('Get employee by id error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// ==================== 4. UPDATE EMPLOYEE ====================
export const updateEmployee = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    upload.fields([
      { name: 'employee_photo', maxCount: 1 },
      { name: 'pan_card', maxCount: 1 },
      { name: 'cv', maxCount: 1 },
      { name: 'bank_details', maxCount: 1 },
      { name: 'aadhar_card', maxCount: 1 },
      { name: 'degree_certificate', maxCount: 1 },
      { name: 'light_bill', maxCount: 1 }
    ])(req, res, async (err: any) => {
      if (err) {
        return res.status(400).json({ 
          success: false, 
          message: err.message 
        });
      }

      const transaction = await sequelize.transaction();
      
      try {
        const employees = await sequelize.query(
          `SELECT id FROM employees WHERE id = :id`,
          { replacements: { id }, type: 'SELECT', transaction }
        );

        if ((employees as any[]).length === 0) {
          await transaction.rollback();
          return res.status(404).json({
            success: false,
            message: 'Employee not found'
          });
        }

        if (Object.keys(req.body).length > 0) {
          await updateEmployeeSchema.validate(req.body, { abortEarly: false });
        }
        
        const updateData = req.body;
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };

        // 🔍 CHECK FOR DUPLICATES IN UPDATE
        if (updateData.email || updateData.mobile || updateData.account_number || 
            updateData.pan_number || updateData.aadhar_number) {
          
          let duplicateQuery = `SELECT id, email, mobile, account_number, pan_number, aadhar_number 
                                FROM employees WHERE (`;
          let conditions = [];
          let dupReplacements: any = { id };
          
          if (updateData.email) {
            conditions.push(`email = :email`);
            dupReplacements.email = updateData.email;
          }
          if (updateData.mobile) {
            conditions.push(`mobile = :mobile`);
            dupReplacements.mobile = updateData.mobile;
          }
          if (updateData.account_number) {
            conditions.push(`account_number = :account_number`);
            dupReplacements.account_number = updateData.account_number;
          }
          if (updateData.pan_number) {
            conditions.push(`pan_number = :pan_number`);
            dupReplacements.pan_number = updateData.pan_number;
          }
          if (updateData.aadhar_number) {
            conditions.push(`aadhar_number = :aadhar_number`);
            dupReplacements.aadhar_number = updateData.aadhar_number;
          }
          
          duplicateQuery += conditions.join(' OR ') + `) AND id != :id`;
          
          const existingCheck = await sequelize.query(duplicateQuery, {
            replacements: dupReplacements,
            type: 'SELECT',
            transaction
          });
          
          if ((existingCheck as any[]).length > 0) {
            await transaction.rollback();
            return res.status(400).json({
              success: false,
              message: 'Duplicate value found'
            });
          }
        }

        // Update employee fields - 👈 UPDATED with department_id and designation_id
        const updates = ['updated_at = NOW()'];
        const replacements: any = { id };

        const updatableFields = [
          'first_name', 'last_name', 'date_of_birth', 'gender', 'marital_status',
          'email', 'mobile', 'alternate_mobile', 'address', 'city', 'state',
          'blood_group', 'qualification', 'department_id', 'designation_id',
          'date_of_joining', 'salary', 'overtime_per_day', 'travel_allowance',
          'account_number', 'bank_name', 'ifsc_code', 'branch_name',
          'pan_number', 'aadhar_number'
        ];

        updatableFields.forEach(field => {
          if (updateData[field] !== undefined) {
            updates.push(`${field} = :${field}`);
            replacements[field] = updateData[field];
          }
        });

        if (updates.length > 1) {
          await sequelize.query(
            `UPDATE employees SET ${updates.join(', ')} WHERE id = :id`,
            { replacements, type: 'UPDATE', transaction }
          );
        }

        // Handle document updates
        const documentTypes = [
          'employee_photo', 'pan_card', 'cv', 'bank_details',
          'aadhar_card', 'degree_certificate', 'light_bill'
        ];

        for (const docType of documentTypes) {
          const fileList = files[docType];
          if (fileList && fileList.length > 0) {
            const file = fileList[0];

            // Delete old document
            const oldDocs = await sequelize.query(
              `SELECT file_path FROM employee_documents 
               WHERE employee_id = :id AND document_type = :docType`,
              { replacements: { id, docType }, type: 'SELECT', transaction }
            );

            if ((oldDocs as any[]).length > 0) {
              const oldPath = (oldDocs as any[])[0].file_path;
              const oldKey = oldPath.replace(`${BASE_URL}/`, '');
              
              try {
                const deleteCommand = new DeleteObjectCommand({
                  Bucket: BUCKET,
                  Key: oldKey,
                });
                await s3Client.send(deleteCommand);
              } catch (deleteError) {
                console.log('Error deleting old file:', deleteError);
              }

              await sequelize.query(
                `DELETE FROM employee_documents 
                 WHERE employee_id = :id AND document_type = :docType`,
                { replacements: { id, docType }, type: 'DELETE', transaction }
              );
            }

            // Upload new file
            const key = `employees/${id}/${docType}/${Date.now()}-${file.originalname}`;
            
            const command = new PutObjectCommand({
              Bucket: BUCKET,
              Key: key,
              Body: file.buffer,
              ContentType: file.mimetype,
            });

            await s3Client.send(command);
            
            const fileUrl = `${BASE_URL}/${key}`;

            await sequelize.query(
              `INSERT INTO employee_documents 
               (id, employee_id, document_type, file_path, file_name, file_type, file_size, uploaded_at)
               VALUES 
               (:id, :employee_id, :document_type, :file_path, :file_name, :file_type, :file_size, NOW())`,
              {
                replacements: {
                  id: uuidv4(),
                  employee_id: id,
                  document_type: docType,
                  file_path: fileUrl,
                  file_name: file.originalname,
                  file_type: file.mimetype,
                  file_size: file.size
                },
                type: 'INSERT',
                transaction
              }
            );
          }
        }

        await transaction.commit();

        // Get updated employee with department and designation names - 👈 UPDATED
        const updatedEmployee = await sequelize.query(
          `SELECT e.*, d.name as department_name, deg.name as designation_name
           FROM employees e
           LEFT JOIN departments d ON e.department_id = d.id
           LEFT JOIN designations deg ON e.designation_id = deg.id
           WHERE e.id = :id`,
          { replacements: { id }, type: 'SELECT' }
        );

        const documents = await sequelize.query(
          `SELECT document_type, file_path, file_name FROM employee_documents WHERE employee_id = :id`,
          { replacements: { id }, type: 'SELECT' }
        );

        res.json({
          success: true,
          message: 'Employee updated successfully',
          data: {
            employee: (updatedEmployee as any[])[0],
            documents
          }
        });

      } catch (error) {
        await transaction.rollback();
        
        if (error instanceof yup.ValidationError) {
          return res.status(400).json({ 
            success: false, 
            message: 'Validation failed',
            errors: error.errors 
          });
        }
        
        console.error('Update employee error:', error);
        res.status(500).json({ 
          success: false, 
          message: 'Server error' 
        });
      }
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// ==================== 5. DELETE EMPLOYEE ====================
export const deleteEmployee = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;

    const employees = await sequelize.query(
      `SELECT id FROM employees WHERE id = :id AND status = 'active'`,
      { replacements: { id }, type: 'SELECT', transaction }
    );

    if ((employees as any[]).length === 0) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    await sequelize.query(
      `UPDATE employees SET status = 'inactive', updated_at = NOW() WHERE id = :id`,
      { replacements: { id }, type: 'UPDATE', transaction }
    );

    await transaction.commit();

    res.json({
      success: true,
      message: 'Employee deleted successfully'
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Delete employee error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// ==================== 6. UPDATE EMPLOYEE STATUS ====================
export const updateEmployeeStatus = async (req: Request, res: Response) => {
  try {
    const { id, status } = req.body;

    // Basic validation
    if (!id || !status) {
      return res.status(400).json({
        success: false,
        message: 'ID and status are required'
      });
    }

    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be active or inactive'
      });
    }

    // Update status
    const [result] = await sequelize.query(
      `UPDATE employees 
       SET status = :status, updated_at = NOW() 
       WHERE id = :id 
       RETURNING id, first_name, last_name, status`,
      { 
        replacements: { id, status }, 
        type: 'UPDATE' 
      }
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    res.json({
      success: true,
      message: `Employee ${status === 'active' ? 'activated' : 'deactivated'} successfully`,
      data: result
    });

  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error'
    });
  }
};