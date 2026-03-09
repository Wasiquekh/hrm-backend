import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

class Designation extends Model {
  public id!: string;
  public name!: string;
  public created_at!: Date;
  public updated_at!: Date;
}

Designation.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
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
    modelName: 'Designation',
    tableName: 'designations',
    timestamps: false,
  }
);

export default Designation;