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

/** Flatten a ZodError into { field: message } for the forms. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Admin panel
// ---------------------------------------------------------------------------

export const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens");

const minuteOfDay = z.number().int().min(0).max(24 * 60);

/** Fields an admin may change on an existing room. */
export const roomEditSchema = z.object({
  name: z.string().trim().min(2).max(120),
  number: z.string().trim().min(1).max(40),
  building: z.string().trim().min(2).max(120),
  type: z.enum(["MEETING", "CONFERENCE", "ADAPTABLE"]),
  summary: z.string().trim().min(5).max(300),
  description: z.string().trim().max(4000).optional().or(z.literal("")),
  capacity: z.number().int().min(1).max(2000),
  maxOccupancy: z.number().int().min(1).max(5000).nullable(),
  widthFt: z.number().int().min(1).max(1000).nullable(),
  lengthFt: z.number().int().min(1).max(1000).nullable(),
  isBookable: z.boolean(),
  needsApproval: z.boolean(),
  openMinute: minuteOfDay,
  closeMinute: minuteOfDay,
  openDays: z.array(z.number().int().min(0).max(6)).max(7),
  minMinutes: z.number().int().min(15).max(24 * 60),
  maxMinutes: z.number().int().min(15).max(24 * 60),
  advanceDays: z.number().int().min(1).max(730),
  sortOrder: z.number().int().min(0).max(10_000),
});

export const roomCreateSchema = roomEditSchema.extend({ slug });

export type RoomEditInput = z.infer<typeof roomEditSchema>;

/** Cross-field checks that a per-field schema cannot express. */
export function roomRuleErrors(input: RoomEditInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (input.closeMinute <= input.openMinute) {
    errors.closeMinute = "Closing time must be after opening time.";
  }
  if (input.maxMinutes < input.minMinutes) {
    errors.maxMinutes = "Maximum length cannot be shorter than the minimum.";
  }
  if (input.maxMinutes > input.closeMinute - input.openMinute) {
    errors.maxMinutes = "Maximum length is longer than the room is open.";
  }
  if (input.maxOccupancy !== null && input.maxOccupancy < input.capacity) {
    errors.maxOccupancy = "Posted occupancy cannot be below the seated count.";
  }
  if (input.openDays.length === 0) {
    errors.openDays = "Pick at least one open day.";
  }
  return errors;
}

export const staffMemberSchema = z.object({
  email: z.email("Enter a valid email address").max(180),
  name: z.string().trim().max(120).optional().or(z.literal("")),
  role: z.enum(["ADMIN", "STAFF"]),
  note: z.string().trim().max(300).optional().or(z.literal("")),
});

export const imageMetaSchema = z.object({
  imageId: z.string().min(1),
  alt: z.string().trim().min(3, "Describe the photo for screen readers").max(300),
});
