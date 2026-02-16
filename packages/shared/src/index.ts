import { z } from "zod";

export const SourceConfigSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  platform: z.string().min(1),
  baseUrl: z.string().url(),
  active: z.boolean().default(true),
  createdAt: z.string()
});

export const CreateSourceInputSchema = z.object({
  name: z.string().min(1),
  platform: z.string().min(1),
  baseUrl: z.string().url(),
  active: z.boolean().optional().default(true)
});

export const SourceStatusSchema = z.object({
  totalSources: z.number().int().nonnegative(),
  activeSources: z.number().int().nonnegative(),
  lastUpdatedAt: z.string().nullable()
});

export const JobSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  externalId: z.string(),
  title: z.string(),
  location: z.string(),
  rate: z.number().nonnegative(),
  description: z.string(),
  createdAt: z.string()
});

export const CandidateSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  resumeText: z.string(),
  stage: z.enum(["new", "screening", "interview", "offer", "hired", "rejected"]).default("new"),
  createdAt: z.string(),
  grade: z
    .object({
      overall: z.number().min(0).max(100),
      skillMatch: z.number().min(0).max(100),
      relevance: z.number().min(0).max(100),
      summary: z.string()
    })
    .nullable()
});

export const CreateCandidateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  resumeText: z.string().min(1)
});

export const ApplicationSchema = z.object({
  id: z.string(),
  candidateId: z.string(),
  jobId: z.string(),
  stage: z.enum(["new", "screening", "interview", "offer", "hired", "rejected"]),
  notes: z.string().default(""),
  match: z
    .object({
      knockoutPassed: z.boolean(),
      weightedScore: z.number().min(0).max(100),
      explanation: z.string()
    })
    .nullable(),
  createdAt: z.string()
});

export const CreateApplicationSchema = z.object({
  candidateId: z.string(),
  jobId: z.string()
});

export type SourceConfig = z.infer<typeof SourceConfigSchema>;
export type CreateSourceInput = z.infer<typeof CreateSourceInputSchema>;
export type SourceStatus = z.infer<typeof SourceStatusSchema>;
export type Job = z.infer<typeof JobSchema>;
export type Candidate = z.infer<typeof CandidateSchema>;
export type Application = z.infer<typeof ApplicationSchema>;

export const CapabilitySchema = z.object({
  id: z.string(),
  description: z.string(),
  kind: z.enum(["read", "mutate"])
});
export type Capability = z.infer<typeof CapabilitySchema>;
