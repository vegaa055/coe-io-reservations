"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { IDENTITY_COOKIE, requireStaff } from "@/lib/auth";
import { cancelBooking, createBooking } from "@/lib/bookings";
import { prisma } from "@/lib/prisma";
import {
  bookingInputSchema,
  cancelInputSchema,
  fieldErrors,
  identitySchema,
  staffActionSchema,
} from "@/lib/validation";

export type BookingFormState =
  | { status: "idle" }
  | { status: "error"; message: string; fields?: Record<string, string> }
  | {
      status: "success";
      manageToken: string;
      needsApproval: boolean;
      roomName: string;
      startsAt: string;
      endsAt: string;
    };

function num(value: FormDataEntryValue | null, fallback = NaN): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function str(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

export async function createBookingAction(
  _prev: BookingFormState,
  formData: FormData,
): Promise<BookingFormState> {
  const parsed = bookingInputSchema.safeParse({
    roomSlug: str(formData.get("roomSlug")),
    dateKey: str(formData.get("dateKey")),
    startMinute: num(formData.get("startMinute")),
    durationMinutes: num(formData.get("durationMinutes")),
    title: str(formData.get("title")),
    purpose: str(formData.get("purpose")),
    attendees: num(formData.get("attendees"), 1),
    requesterName: str(formData.get("requesterName")),
    requesterEmail: str(formData.get("requesterEmail")),
    requesterPhone: str(formData.get("requesterPhone")),
    department: str(formData.get("department")),
  });

  if (!parsed.success) {
    const fields = fieldErrors(parsed.error);
    return {
      status: "error",
      message: "Check the highlighted fields and try again.",
      fields,
    };
  }

  const result = await createBooking(parsed.data);
  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  // Remember who this is so the next booking is pre-filled.
  (await cookies()).set(
    IDENTITY_COOKIE,
    encodeURIComponent(
      JSON.stringify({
        name: parsed.data.requesterName,
        email: parsed.data.requesterEmail,
        department: parsed.data.department || "",
      }),
    ),
    { httpOnly: false, sameSite: "lax", maxAge: 60 * 60 * 24 * 180, path: "/" },
  );

  const room = await prisma.room.findUnique({ where: { slug: parsed.data.roomSlug } });
  revalidatePath(`/rooms/${parsed.data.roomSlug}`);
  revalidatePath("/");

  return {
    status: "success",
    manageToken: result.booking.manageToken,
    needsApproval: result.booking.status === "PENDING",
    roomName: room?.name ?? parsed.data.roomSlug,
    startsAt: result.booking.startsAt.toISOString(),
    endsAt: result.booking.endsAt.toISOString(),
  };
}

export type SimpleState = { status: "idle" | "success"; message?: string } | { status: "error"; message: string };

export async function cancelBookingAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  const parsed = cancelInputSchema.safeParse({
    manageToken: str(formData.get("manageToken")),
    reason: str(formData.get("reason")),
  });
  if (!parsed.success) {
    return { status: "error", message: "That cancellation link is not valid." };
  }

  const result = await cancelBooking(parsed.data.manageToken, parsed.data.reason || null);
  if (!result.ok) return { status: "error", message: result.message };

  revalidatePath("/reservations");
  revalidatePath("/staff");
  revalidatePath("/");
  return { status: "success", message: "Reservation cancelled." };
}

export async function staffBookingAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  const staff = await requireStaff();
  if (!staff) return { status: "error", message: "You do not have access to that." };

  const bookingId = str(formData.get("bookingId"));
  const parsed = staffActionSchema.safeParse({
    action: str(formData.get("action")),
    note: str(formData.get("note")),
  });
  if (!bookingId || !parsed.success) {
    return { status: "error", message: "Unrecognised action." };
  }

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return { status: "error", message: "That reservation no longer exists." };

  const { action, note } = parsed.data;
  const data =
    action === "confirm"
      ? { status: "CONFIRMED" as const, staffNote: note || null }
      : action === "deny"
        ? { status: "DENIED" as const, staffNote: note || null, cancelledAt: new Date() }
        : {
            status: "CANCELLED" as const,
            staffNote: note || null,
            cancelledAt: new Date(),
            cancelReason: note || "Cancelled by center staff",
          };

  try {
    await prisma.booking.update({ where: { id: bookingId }, data });
  } catch (error) {
    // Approving a pending request can collide with a confirmed booking that was
    // made in the meantime; the exclusion constraint catches it.
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("23P01") || message.includes("bookings_no_overlap")) {
      return {
        status: "error",
        message: "That slot is now taken by a confirmed reservation. Deny this request instead.",
      };
    }
    throw error;
  }

  revalidatePath("/staff");
  revalidatePath("/");
  return {
    status: "success",
    message:
      action === "confirm"
        ? "Reservation confirmed."
        : action === "deny"
          ? "Request denied."
          : "Reservation cancelled.",
  };
}

export async function setIdentityAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  const parsed = identitySchema.safeParse({
    name: str(formData.get("name")),
    email: str(formData.get("email")),
    department: str(formData.get("department")),
  });
  if (!parsed.success) {
    return { status: "error", message: "Enter your name and a valid email address." };
  }

  (await cookies()).set(IDENTITY_COOKIE, encodeURIComponent(JSON.stringify(parsed.data)), {
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 180,
    path: "/",
  });

  revalidatePath("/", "layout");
  return { status: "success", message: `Signed in as ${parsed.data.name}.` };
}

export async function clearIdentityAction(): Promise<void> {
  (await cookies()).delete(IDENTITY_COOKIE);
  revalidatePath("/", "layout");
}
