import { z } from "zod";

export const projectSchema = z.object({
  company_name: z.string().min(1, "Company name is required"),
  industry: z.string().optional(),
  fiscal_year: z.string().optional(),
  business_unit: z.string().optional(),
  vision: z.string().optional(),
  mission: z.string().optional(),
  strategic_themes: z.string().optional(),
  prepared_by: z.string().optional(),
  prepared_date: z.string().optional(),
});

export const objectiveSchema = z.object({
  name: z.string().min(1, "Objective name is required"),
  description: z.string().optional(),
  priority: z.string().optional(),
  owner: z.string().optional(),
  timeline: z.string().optional(),
  status: z.string().optional(),
  color: z.string().optional(),
  department_id: z.string().nullable().optional(),
  perspective_id: z.string().min(1, "Perspective is required"),
  weight: z
    .number({ invalid_type_error: "Weight must be a number" })
    .min(0, "Weight cannot be negative")
    .max(100, "Weight cannot exceed 100%"),
});

export const measureSchema = z.object({
  name: z.string().min(1, "Measure name is required"),
  description: z.string().optional(),
  unit: z.string().optional(),
  weight: z
    .number({ invalid_type_error: "Weight must be a number" })
    .min(0, "Weight cannot be negative")
    .max(100, "Weight cannot exceed 100%"),
  baseline: z.number().default(0),
  stretch_target: z.number().default(0),
  time_period: z.enum(["Annual", "Quarterly"]),
  owner: z.string().optional(),
  data_source: z.string().optional(),
  comments: z.string().optional(),
  objective_id: z.string().min(1),
});

export const targetSchema = z.object({
  measure_id: z.string(),
  period: z.string().min(1),
  target_value: z
    .number({ invalid_type_error: "Target must be a number" })
    .min(0, "Targets cannot be negative"),
  actual_value: z
    .number({ invalid_type_error: "Actual must be a number" })
    .min(0, "Actuals cannot be negative"),
});

export const initiativeSchema = z.object({
  name: z.string().min(1, "Initiative name is required"),
  description: z.string().optional(),
  budget: z.number().min(0).default(0),
  owner: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  progress: z.number().min(0).max(100).default(0),
  status: z.string().optional(),
  risk_level: z.string().optional(),
  expected_impact: z.string().optional(),
  dependencies: z.string().optional(),
  measure_ids: z.array(z.string()).optional(),
});

/**
 * Validate a raw row-object (from Excel) against a schema, returning
 * { data, errors: [{field, message}] }
 */
export const validateRow = (schema, row) => {
  const parsed = schema.safeParse(row);
  if (parsed.success) return { data: parsed.data, errors: [] };
  return {
    data: null,
    errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
  };
};
