import { z } from "zod";

const dateKey = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a date like 2026-09-03");

export const bookingInputSchema = z.object({
  roomSlug: z.string().min(1),
  dateKey,
  startMinute: z.number().int().min(0).max(24 * 60 - 1),
  durationMinutes: z.number().int().positive().max(24 * 60),
  title: z.string().trim().min(3, "Give the reservation a short title").max(120),
  purpose: z.string().trim().max(1000).optional().or(z.literal("")),
  attendees: z.number().int().min(1).max(1000),
  requesterName: z.string().trim().min(2, "Enter your name").max(120),
  requesterEmail: z.email("Enter a valid email address").max(180),
  requesterPhone: z.string().trim().max(40).optional().or(z.literal("")),
  department: z.string().trim().max(120).optional().or(z.literal("")),
});

export type BookingInput = z.infer<typeof bookingInputSchema>;

export const cancelInputSchema = z.object({
  manageToken: z.string().min(1),
  reason: z.string().trim().max(500).optional().or(z.literal("")),
});

export const staffActionSchema = z.object({
  action: z.enum(["confirm", "deny", "cancel"]),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export const identitySchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().max(180),
  department: z.string().trim().max(120).optional().or(z.literal("")),
});

/** Flatten a ZodError into { field: message } for the forms. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
