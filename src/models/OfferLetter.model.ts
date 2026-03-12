// OfferLetter.model.ts
import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database";

class OfferLetter extends Model {
  public id!: string;
  public first_name!: string;
  public last_name!: string;
  public email!: string;
  public phone!: string;
  public job_title!: string;
  public department_id!: string;
  public employment_type!: string;
  public offered_salary!: number;
  public offer_date!: Date;
  public joining_date!: Date;
  public reporting_manager!: string;
  public reporting_manager_id!: string;
  public work_location!: string;
  public offer_status!: string;
  public remarks!: string;
  public created_by!: string;
  public updated_by!: string;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

OfferLetter.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
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
      unique: true,
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
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
    offer_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    joining_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    reporting_manager: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    reporting_manager_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    work_location: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    offer_status: {
      type: DataTypes.STRING(20),
      defaultValue: "Pending",
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_by: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    updated_by: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "OfferLetter",
    tableName: "offer_letters",
    timestamps: true,
    underscored: true,
  },
);

export default OfferLetter;
