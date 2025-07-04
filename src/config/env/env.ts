import dotenv from "dotenv";
import { z } from "zod";
dotenv.config();

const envSchema = z.object({
    NODE_ENV: z.union([z.undefined(), z.enum(["development", "production"])]),
    POSTGRES_HOST: z.union([z.undefined(), z.string()]),
    POSTGRES_PORT: z
        .string()
        .regex(/^[0-9]+$/)
        .transform((value) => parseInt(value)),
    POSTGRES_DB: z.string(),
    POSTGRES_USER: z.string(),
    POSTGRES_PASSWORD: z.string(),
    APP_PORT: z.union([
        z.undefined(),
        z
            .string()
            .regex(/^[0-9]+$/)
            .transform((value) => parseInt(value)),
    ]),
    WB_API_KEY: z.string(),
    GOOGLE_SHEETS_IDS: z
        .string()
        .min(1)
        .transform((str) => str.split(",").map((id) => id.trim()))
        .refine((arr) => arr.every((id) => /^[a-zA-Z0-9-_]+$/.test(id))),
    GOOGLE_API_CREDENTIALS_PATH: z.string(),
});

const env = envSchema.parse({
    POSTGRES_HOST: process.env.POSTGRES_HOST,
    POSTGRES_PORT: process.env.POSTGRES_PORT,
    POSTGRES_DB: process.env.POSTGRES_DB,
    POSTGRES_USER: process.env.POSTGRES_USER,
    POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD,
    NODE_ENV: process.env.NODE_ENV,
    APP_PORT: process.env.APP_PORT,
    WB_API_KEY: process.env.WB_API_KEY,
    GOOGLE_SHEETS_IDS: process.env.GOOGLE_SHEETS_IDS,
    GOOGLE_API_CREDENTIALS_PATH: process.env.GOOGLE_API_CREDENTIALS_PATH,
});

export default env;
