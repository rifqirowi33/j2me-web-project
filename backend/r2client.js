import { S3Client } from "@aws-sdk/client-s3";

export function createS3Client(config) {
  const {
    R2_REGION = "auto",
    R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
  } = config;

  if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error("❌ R2_ACCESS_KEY_ID atau R2_SECRET_ACCESS_KEY kosong");
  }

  return new S3Client({
    region: R2_REGION,
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}