import { app } from "./app.js";
import { env } from "./config/env.js";

const bootstrap = async (): Promise<void> => {
  app.listen(env.PORT, "0.0.0.0", () => {
    console.log(`✅ LinguaStar backend running on PORT ${env.PORT}`);
    console.log(`📍 Health check: GET http://localhost:${env.PORT}/health`);
    console.log(`📍 API health: GET http://localhost:${env.PORT}/api/v1/health`);
    console.log(`🔧 Environment: ${env.NODE_ENV}`);
    if (!env.SUPABASE_URL) {
      console.warn("⚠️  Supabase not configured - database operations will fail");
    }
  });
};

bootstrap().catch((error) => {
  console.error("Failed to bootstrap server", error);
  process.exit(1);
});
