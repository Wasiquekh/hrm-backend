import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import sequelize from "../config/database";
import * as yup from "yup";

// ==================== VALIDATION SCHEMAS ====================

// Create Validation Schema
const createOfferSchema = yup.object({
  first_name: yup.string().required("First name is required"),
  last_name: yup.string().required("Last name is required"),
  email: yup
    .string()
    .email("Invalid email format")
    .required("Email is required"),
  phone: yup.string().nullable(),
  job_title: yup.string().required("Job title is required"),
  department_id: yup
    .string()
    .required("Department is required")
    .uuid("Invalid department ID"),
  employment_type: yup
    .string()
    .required("Employment type is required")
    .oneOf(["Full-time", "Part-time", "Contract", "Internship"]),
  offered_salary: yup
    .number()
    .required("Salary is required")
    .positive("Salary must be positive"),
  offer_date: yup.date().required("Offer date is required"),
  joining_date: yup.date().nullable(),
  reporting_manager: yup.string().required("Reporting manager is required"),
  work_location: yup.string().required("Work location is required"),
  offer_status: yup
    .string()
    .oneOf(["Pending", "Accepted", "Rejected", "Expired"])
    .default("Pending"),
  created_by: yup.string().nullable().uuid("Invalid user ID"),
});

// Update Validation Schema
const updateOfferSchema = yup.object({
  first_name: yup.string().optional(),
  last_name: yup.string().optional(),
  email: yup.string().email("Invalid email format").optional(),
  phone: yup.string().nullable().optional(),
  job_title: yup.string().optional(),
  department_id: yup.string().uuid("Invalid department ID").optional(),
  employment_type: yup
    .string()
    .oneOf(["Full-time", "Part-time", "Contract", "Internship"])
    .optional(),
  offered_salary: yup.number().positive("Salary must be positive").optional(),
  offer_date: yup.date().optional(),
  joining_date: yup.date().nullable().optional(),
  reporting_manager: yup.string().optional(),
  work_location: yup.string().optional(),
  offer_status: yup
    .string()
    .oneOf(["Pending", "Accepted", "Rejected", "Expired"])
    .optional(),
  updated_by: yup.string().nullable().uuid("Invalid user ID"),
});

// ==================== 1. CREATE ====================
export const createOfferLetter = async (req: Request, res: Response) => {
  try {
    // Validate request body
    await createOfferSchema.validate(req.body, { abortEarly: false });

    const {
      first_name,
      last_name,
      email,
      phone,
      job_title,
      department_id,
      employment_type,
      offered_salary,
      offer_date,
      joining_date,
      reporting_manager,
      work_location,
      offer_status,
      created_by,
    } = req.body;

    // Check if email exists
    const existing = await sequelize.query(
      `SELECT id FROM offer_letters WHERE email = :email`,
      { replacements: { email }, type: "SELECT" },
    );

    if ((existing as any[]).length > 0) {
      return res
        .status(400)
        .json({ success: false, message: "Email already exists" });
    }

    const id = uuidv4();

    await sequelize.query(
      `INSERT INTO offer_letters (
        id, first_name, last_name, email, phone, job_title, department_id,
        employment_type, offered_salary, offer_date, joining_date,
        reporting_manager, work_location, offer_status, created_by, updated_by
      ) VALUES (
        :id, :first_name, :last_name, :email, :phone, :job_title, :department_id,
        :employment_type, :offered_salary, :offer_date, :joining_date,
        :reporting_manager, :work_location, :offer_status, :created_by, :created_by
      )`,
      {
        replacements: {
          id,
          first_name,
          last_name,
          email,
          phone: phone || null,
          job_title,
          department_id,
          employment_type,
          offered_salary,
          offer_date,
          joining_date: joining_date || null,
          reporting_manager,
          work_location,
          offer_status: offer_status || "Pending",
          created_by,
        },
      },
    );

    const newOffer = await sequelize.query(
      `SELECT o.*, d.name as department_name 
       FROM offer_letters o
       LEFT JOIN departments d ON o.department_id = d.id
       WHERE o.id = :id`,
      { replacements: { id }, type: "SELECT" },
    );

    res.status(201).json({
      success: true,
      message: "Offer letter created successfully",
      data: (newOffer as any[])[0],
    });
  } catch (error) {
    if (error instanceof yup.ValidationError) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.errors,
      });
    }
    console.error("Create error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ==================== 2. GET ALL ====================
export const getAllOfferLetters = async (req: Request, res: Response) => {
  try {
    const offers = await sequelize.query(
      `SELECT 
        o.*,
        d.name as department_name
      FROM offer_letters o
      LEFT JOIN departments d ON o.department_id = d.id
      ORDER BY o.created_at DESC`,
      { type: "SELECT" },
    );

    res.json({
      success: true,
      data: offers,
    });
  } catch (error) {
    console.error("Get all error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ==================== 3. GET BY ID ====================
export const getOfferLetterById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const offers = await sequelize.query(
      `SELECT 
        o.*,
        d.name as department_name
      FROM offer_letters o
      LEFT JOIN departments d ON o.department_id = d.id
      WHERE o.id = :id`,
      { replacements: { id }, type: "SELECT" },
    );

    if ((offers as any[]).length === 0) {
      return res.status(404).json({
        success: false,
        message: "Offer letter not found",
      });
    }

    res.json({
      success: true,
      data: (offers as any[])[0],
    });
  } catch (error) {
    console.error("Get by id error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ==================== 4. UPDATE ====================
export const updateOfferLetter = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body;

    // Validate request body
    await updateOfferSchema.validate(data, { abortEarly: false });

    // Check if exists
    const offers = await sequelize.query(
      `SELECT id FROM offer_letters WHERE id = :id`,
      { replacements: { id }, type: "SELECT" },
    );

    if ((offers as any[]).length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Offer letter not found" });
    }

    // Check email if being updated
    if (data.email) {
      const existing = await sequelize.query(
        `SELECT id FROM offer_letters WHERE email = :email AND id != :id`,
        { replacements: { email: data.email, id }, type: "SELECT" },
      );

      if ((existing as any[]).length > 0) {
        return res
          .status(400)
          .json({ success: false, message: "Email already exists" });
      }
    }

    // Dynamic update - only fields that are provided
    const updateFields = [];
    const replacements: any = { id };

    const fields = [
      "first_name",
      "last_name",
      "email",
      "phone",
      "job_title",
      "department_id",
      "employment_type",
      "offered_salary",
      "offer_date",
      "joining_date",
      "reporting_manager",
      "work_location",
      "offer_status",
    ];

    fields.forEach((field) => {
      if (data[field] !== undefined) {
        updateFields.push(`${field} = :${field}`);
        replacements[field] = data[field];
      }
    });

    if (data.updated_by) {
      updateFields.push("updated_by = :updated_by");
      replacements.updated_by = data.updated_by;
    }

    updateFields.push("updated_at = NOW()");

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No fields to update",
      });
    }

    await sequelize.query(
      `UPDATE offer_letters SET ${updateFields.join(", ")} WHERE id = :id`,
      { replacements },
    );

    const updated = await sequelize.query(
      `SELECT o.*, d.name as department_name 
       FROM offer_letters o
       LEFT JOIN departments d ON o.department_id = d.id
       WHERE o.id = :id`,
      { replacements: { id }, type: "SELECT" },
    );

    res.json({
      success: true,
      message: "Offer letter updated successfully",
      data: (updated as any[])[0],
    });
  } catch (error) {
    if (error instanceof yup.ValidationError) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.errors,
      });
    }
    console.error("Update error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ==================== 5. DELETE ====================
export const deleteOfferLetter = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if exists
    const offers = await sequelize.query(
      `SELECT id FROM offer_letters WHERE id = :id`,
      { replacements: { id }, type: "SELECT" },
    );

    if ((offers as any[]).length === 0) {
      return res.status(404).json({
        success: false,
        message: "Offer letter not found",
      });
    }

    await sequelize.query(`DELETE FROM offer_letters WHERE id = :id`, {
      replacements: { id },
      type: "DELETE",
    });

    res.json({
      success: true,
      message: "Offer letter deleted successfully",
    });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
