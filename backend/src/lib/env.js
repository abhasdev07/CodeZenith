import dotenv from "dotenv";

dotenv.config({ quiet: true });

export const ENV = {
  PORT: process.env.PORT,
  DB_URL: process.env.DB_URL,
  NODE_ENV: process.env.NODE_ENV,
  CLIENT_URL: process.env.CLIENT_URL,
  INNGEST_EVENT_KEY: process.env.INNGEST_EVENT_KEY,
  INNGEST_SIGNING_KEY: process.env.INNGEST_SIGNING_KEY,
  STREAM_API_KEY: process.env.STREAM_API_KEY,
  STREAM_API_SECRET: process.env.STREAM_API_SECRET,
  JUDGE0_API_URL: process.env.JUDGE0_API_URL || "https://ce.judge0.com",
  CODE_EXECUTION_PROVIDER: process.env.CODE_EXECUTION_PROVIDER,
  ALLOW_LOCAL_CODE_EXECUTION: process.env.ALLOW_LOCAL_CODE_EXECUTION,
};
