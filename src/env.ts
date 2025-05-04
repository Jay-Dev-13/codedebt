import { config } from "dotenv";

import { z } from "zod";

export const LOG_LEVEL = z.enum(["verbose", "critical"]);

const EnvSchema = z.object({
	OLLAMA_BASE_URL: z.string(),
	OLLAMA_MODEL: z.string(),
	GEMINI_API_KEY: z.string(),
	GEMINI_MODEL: z.string(),
	LOG_LEVEL: LOG_LEVEL,
	USE_CACHE: z.coerce.boolean(),
});

const env = config();

if (env.error) {
	console.error("Error loading environment variables:", env.error);
	process.exit(1);
}

export const ENVIRONMENT_VARIABLES = EnvSchema.parse(process.env);
