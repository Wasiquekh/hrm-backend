import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

class SystemUser extends Model {
  public id!: string;
  public name!: string;
  public mobile_number!: string;
  public email!: string;
  public password!: string;
  public totp_secret!: string;
  public created_at!: Date;
  public updated_at!: Date;
  public deleted_at!: Date;
}

SystemUser.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: DataTypes.STRING,
    mobile_number: {
      type: DataTypes.STRING,
      unique: true,              // 👈 Mobile unique
    },
    email: {
      type: DataTypes.STRING,
      unique: true,              // 👈 Email unique
    },
    password: DataTypes.STRING,
    totp_secret: DataTypes.STRING,
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
    deleted_at: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'SystemUser',
    tableName: 'system_users',
    timestamps: false,
  }
);

export default SystemUser;