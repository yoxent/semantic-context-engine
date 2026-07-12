import { z } from "zod";

export const repositoryConfigSchema = z.object({
  path: z.string(),
  type: z.enum(["code", "vault"]),
  name: z.string().optional()
});

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
    .default({ level: "info" })
});

export type SceConfig = z.infer<typeof sceConfigSchema>;
