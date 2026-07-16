import { z } from "zod";

export const repositoryConfigSchema = z.object({
  path: z.string(),
  type: z.enum(["code", "vault"]),
  name: z.string().optional()
});

export const embeddingConfigSchema = z.object({
  provider: z.literal("openai-compatible"),
  baseUrl: z.string().url(),
  model: z.string().min(1),
  dimensions: z.number().int().positive(),
  batchSize: z.number().int().positive().default(32),
  apiKeyEnv: z.string().optional()
});

export type EmbeddingConfig = z.infer<typeof embeddingConfigSchema>;

export const sceConfigSchema = z.object({
  repositories: z.array(repositoryConfigSchema).default([]),
  indexing: z
    .object({
      include: z.array(z.string()).default(["**/*.md"]),
      ignore: z.array(z.string()).default([])
    })
    .default({ include: ["**/*.md"], ignore: [] }),
  search: z
    .object({
      defaultLimit: z.number().int().positive().default(10),
      maxSnippetChars: z.number().int().positive().default(500)
    })
    .default({ defaultLimit: 10, maxSnippetChars: 500 }),
  logging: z
    .object({
      level: z.enum(["silent", "error", "warn", "info", "debug"]).default("info")
    })
    .default({ level: "info" }),
  embedding: embeddingConfigSchema.optional()
});

export type SceConfig = z.infer<typeof sceConfigSchema>;
