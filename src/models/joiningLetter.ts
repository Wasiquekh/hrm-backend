import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database";

class JoiningLetter extends Model {
  public id!: string;
  public offer_letter_id!: string;
  public first_name!: string;
  public last_name!: string;
  public email!: string;
  public job_title!: string;
  public department_id!: string;
  public employment_type!: string;
  public offered_salary!: number;
  public joining_date!: Date;
  public reporting_manager!: string;
  public work_location!: string;
  public joining_status!: string;
  public joining_letter_date!: Date;
  public created_by!: string | null;
  public updated_by!: string | null;
  public created_at!: Date;
  public updated_at!: Date;
}

JoiningLetter.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    offer_letter_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    first_name: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    last_name: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    job_title: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    department_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    employment_type: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    offered_salary: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    joining_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    reporting_manager: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    work_location: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    joining_status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "Pending",
    },
    joining_letter_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    created_by: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    updated_by: {
      type: DataTypes.UUID,
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
    modelName: "JoiningLetter",
    tableName: "joining_letters",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

export default JoiningLetter;
