import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

class Holiday extends Model {
  public id!: string;
  public date!: Date;
  public description!: string;
  public created_at!: Date;
  public updated_at!: Date;
}

Holiday.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      unique: true,  // Ek date par ek hi holiday
    },
    description: {
      type: DataTypes.STRING(255),
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
  },
  {
    sequelize,
    modelName: 'Holiday',
    tableName: 'holidays',
    timestamps: false,
  }
);

export default Holiday;