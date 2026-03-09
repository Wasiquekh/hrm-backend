import { S3Client } from "@aws-sdk/client-s3";
import dotenv from 'dotenv';

dotenv.config();

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "eu-north-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

export const BUCKET = process.env.AWS_S3_BUCKET_NAME || "";
export const BASE_URL = BUCKET ? `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com` : "";

if (!BUCKET) {
  console.warn("⚠️ AWS_S3_BUCKET_NAME is not set");
}

export default s3Client;