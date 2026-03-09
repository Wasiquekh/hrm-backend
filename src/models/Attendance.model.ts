import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

// Status types as per your table
export type AttendanceStatus = 'P' | 'A' | 'PL' | 'HD' | 'L' | 'H' | 'SL' | 'OT';

class Attendance extends Model {
  public id!: string;
  public employee_id!: string;
  public date!: Date;
  public status!: AttendanceStatus;
  public created_at!: Date;
  public updated_at!: Date;
}

Attendance.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    employee_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'employees',
        key: 'id',
      },
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(2),
      allowNull: false,
      validate: {
        isIn: [['P', 'A', 'PL', 'HD', 'L', 'H', 'SL', 'OT']],
      },
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
    modelName: 'Attendance',
    tableName: 'attendances',
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ['employee_id', 'date'],
      },
    ],
  }
);

export default Attendance;