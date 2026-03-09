import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

class EmployeeDocument extends Model {
  public id!: string;
  public employee_id!: string;
  public document_type!: string;
  public file_path!: string;
  public file_name!: string;
  public file_type!: string;
  public file_size!: number | null;
  public uploaded_at!: Date;
}

EmployeeDocument.init(
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
    document_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        isIn: [[
          'employee_photo', 'pan_card', 'cv', 'bank_details',
          'aadhar_card', 'degree_certificate', 'light_bill'
        ]],
      },
    },
    file_path: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    file_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    file_type: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    file_size: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
    uploaded_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'EmployeeDocument',
    tableName: 'employee_documents',
    timestamps: false,
  }
);

export default EmployeeDocument;