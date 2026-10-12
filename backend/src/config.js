import "dotenv/config";

const config = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || "development",

  clientOrigins: (process.env.CLIENT_ORIGIN || "http://localhost:3000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  databaseUrl: process.env.DATABASE_URL || "",
  redisUrl: process.env.REDIS_URL || "",
  aiProvider: process.env.AI_PROVIDER || "gemini",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  groqApiKey: process.env.GROQ_API_KEY || "",
  neonAuthBaseUrl: process.env.NEON_AUTH_BASE_URL || "",
  allowGuest: process.env.ALLOW_GUEST === "true",

  geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  groqModel: process.env.GROQ_MODEL || "openai/gpt-oss-120b",

  resendApiKey: process.env.RESEND_API_KEY || "",
  resendFrom: process.env.RESEND_FROM || "onboarding@resend.dev",
  appUrl: process.env.APP_URL || "http://localhost:3000",

  e2bApiKey: process.env.E2B_API_KEY || "",
};

export default config;
