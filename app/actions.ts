"use server";

import { revalidatePath } from "next/cache";

import { getViewer, requireStaff } from "@/lib/auth";
import {
  bookingRequiresSignIn,
  cancelBooking,
  createBooking,
  isOverlapViolation,
} from "@/lib/bookings";
import { prisma } from "@/lib/prisma";
import {
  bookingInputSchema,
  cancelInputSchema,
  fieldErrors,
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

  const viewer = await getViewer();

  // The real gate. The panel hides the form when sign-in is required, but the
  // action is what a request actually goes through.
  if (!viewer && bookingRequiresSignIn()) {
    return {
      status: "error",
      message: "Sign in with your NetID to reserve a room.",
    };
  }

  // A signed-in booking is made *as* that person: the session wins over
  // whatever the form posted, so staff can trust the requester on a
  // reservation.
  const input = viewer
    ? { ...parsed.data, requesterName: viewer.name, requesterEmail: viewer.email }
    : parsed.data;

  const result = await createBooking(input);
  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  const room = await prisma.room.findUnique({ where: { slug: input.roomSlug } });
  revalidatePath(`/rooms/${input.roomSlug}`);
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
    // Denying or cancelling has to release the space claims, or the room stays
    // blocked. Confirming leaves them alone — they already hold the slot.
    if (action === "deny" || action === "cancel") {
      await prisma.$transaction([
        prisma.bookingSpace.deleteMany({ where: { bookingId } }),
        prisma.booking.update({ where: { id: bookingId }, data }),
      ]);
    } else {
      await prisma.booking.update({ where: { id: bookingId }, data });
    }
  } catch (error) {
    // Approving a pending request can collide with a confirmed booking that was
    // made in the meantime; the exclusion constraint catches it.
    if (isOverlapViolation(error)) {
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
