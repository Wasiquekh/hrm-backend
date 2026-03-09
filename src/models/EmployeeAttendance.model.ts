import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

class EmployeeAttendance extends Model {
  public id!: string;
  public employee_id!: string;
  public attendance_date!: string;
  public punch_in_time!: Date | null;
  public punch_in_image_url!: string | null;
  public punch_out_time!: Date | null;
  public punch_out_image_url!: string | null;
  public total_working_hours!: number | null;  // 👈 Type sahi hai
}

EmployeeAttendance.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    employee_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    attendance_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    punch_in_time: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    punch_in_image_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    punch_out_time: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    punch_out_image_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    total_working_hours: {
      type: DataTypes.FLOAT,  // 👈 CHANGE: DECIMAL se FLOAT kiya
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'EmployeeAttendance',
    tableName: 'employee_attendance',
    timestamps: false,
  }
);

export default EmployeeAttendance;