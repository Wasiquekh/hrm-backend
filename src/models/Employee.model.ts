import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

class Employee extends Model {
  public id!: string;
  public employee_code!: string;
  public first_name!: string;
  public last_name!: string;
  public date_of_birth!: Date;
  public gender!: string;
  public marital_status!: string;
  public email!: string;
  public mobile!: string;
  public alternate_mobile!: string | null;
  public address!: string;
  public city!: string;
  public state!: string;
  public blood_group!: string | null;
  public qualification!: string | null;
  public department_id!: string | null;        // 👈 Changed to UUID
  public designation_id!: string | null;       // 👈 Changed to UUID
  public date_of_joining!: Date;
  public salary!: number;
  public overtime_per_day!: number;
  public travel_allowance!: number;
  public account_number!: string;
  public bank_name!: string;
  public ifsc_code!: string;
  public branch_name!: string;
  public pan_number!: string;
  public aadhar_number!: string;
  public created_at!: Date;
  public updated_at!: Date;
  public status!: string;
}

Employee.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    employee_code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    first_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    last_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    date_of_birth: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    gender: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    marital_status: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    mobile: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    alternate_mobile: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    city: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    state: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    blood_group: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    qualification: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    department_id: {                          // 👈 Updated field
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'departments',
        key: 'id',
      },
    },
    designation_id: {                         // 👈 Updated field
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'designations',
        key: 'id',
      },
    },
    date_of_joining: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    salary: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
      allowNull: false,
    },
    overtime_per_day: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
      allowNull: false,
    },
    travel_allowance: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
      allowNull: false,
    },
    account_number: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    bank_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    ifsc_code: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    branch_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    pan_number: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    aadhar_number: {
      type: DataTypes.STRING(12),
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: 'active',
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: 'Employee',
    tableName: 'employees',
    timestamps: false,
    hooks: {
      beforeCreate: async (employee) => {
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const count = await Employee.count() + 1;
        employee.employee_code = `EMP${year}${month}${count.toString().padStart(4, '0')}`;
      },
    },
  }
);

export default Employee;