"use server";

import { revalidatePath } from "next/cache";

import {
  bootstrapAdminEmails,
  isBootstrapAdmin,
  panelBlockedReason,
  requireAdmin,
} from "@/lib/auth";
import type { AdminState } from "@/lib/admin-state";
import { prisma } from "@/lib/prisma";
import { deleteRoomImage, isManagedUpload, putRoomImage } from "@/lib/storage";
import {
  fieldErrors,
  imageMetaSchema,
  roomCreateSchema,
  roomEditSchema,
  roomRuleErrors,
  staffMemberSchema,
} from "@/lib/validation";

function str(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function optionalInt(value: FormDataEntryValue | null): number | null {
  const raw = str(value);
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function int(value: FormDataEntryValue | null, fallback = 0): number {
  const n = Number(str(value));
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

function bool(value: FormDataEntryValue | null): boolean {
  return str(value) === "on" || str(value) === "true";
}

/**
 * Every admin action starts here. Returns the acting admin, or an error state
 * to return straight to the caller — never a partially-authorised path.
 */
async function guard(): Promise<{ email: string } | AdminState> {
  const blocked = panelBlockedReason();
  if (blocked) return { status: "error", message: blocked };
  const admin = await requireAdmin();
  if (!admin) {
    return { status: "error", message: "You do not have access to that." };
  }
  return { email: admin.email };
}

function isDenied(result: { email: string } | AdminState): result is AdminState {
  return "status" in result;
}

function readRoomForm(formData: FormData) {
  return {
    name: str(formData.get("name")),
    number: str(formData.get("number")),
    building: str(formData.get("building")),
    type: str(formData.get("type")),
    summary: str(formData.get("summary")),
    description: str(formData.get("description")),
    capacity: int(formData.get("capacity"), 1),
    maxOccupancy: optionalInt(formData.get("maxOccupancy")),
    widthFt: optionalInt(formData.get("widthFt")),
    lengthFt: optionalInt(formData.get("lengthFt")),
    isBookable: bool(formData.get("isBookable")),
    needsApproval: bool(formData.get("needsApproval")),
    openMinute: int(formData.get("openMinute"), 420),
    closeMinute: int(formData.get("closeMinute"), 1200),
    openDays: formData
      .getAll("openDays")
      .map((d) => Number(d))
      .filter((d) => Number.isInteger(d)),
    minMinutes: int(formData.get("minMinutes"), 30),
    maxMinutes: int(formData.get("maxMinutes"), 240),
    advanceDays: int(formData.get("advanceDays"), 120),
    sortOrder: int(formData.get("sortOrder"), 0),
  };
}

export async function updateRoomAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const auth = await guard();
  if (isDenied(auth)) return auth;

  const slug = str(formData.get("slug"));
  const parsed = roomEditSchema.safeParse(readRoomForm(formData));
  if (!parsed.success) {
    return { status: "error", message: "Check the highlighted fields.", fields: fieldErrors(parsed.error) };
  }
  const ruleErrors = roomRuleErrors(parsed.data);
  if (Object.keys(ruleErrors).length) {
    return { status: "error", message: "Check the highlighted fields.", fields: ruleErrors };
  }

  const room = await prisma.room.findUnique({ where: { slug } });
  if (!room) return { status: "error", message: "That room no longer exists." };

  await prisma.room.update({
    where: { slug },
    data: { ...parsed.data, description: parsed.data.description || null },
  });

  revalidatePath("/admin/rooms");
  revalidatePath(`/rooms/${slug}`);
  revalidatePath("/");
  return { status: "success", message: `Saved ${parsed.data.name}.` };
}

export async function createRoomAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const auth = await guard();
  if (isDenied(auth)) return auth;

  const parsed = roomCreateSchema.safeParse({
    ...readRoomForm(formData),
    slug: str(formData.get("slug")),
  });
  if (!parsed.success) {
    return { status: "error", message: "Check the highlighted fields.", fields: fieldErrors(parsed.error) };
  }
  const ruleErrors = roomRuleErrors(parsed.data);
  if (Object.keys(ruleErrors).length) {
    return { status: "error", message: "Check the highlighted fields.", fields: ruleErrors };
  }

  const { slug, ...fields } = parsed.data;
  const clash = await prisma.room.findFirst({
    where: { OR: [{ slug }, { number: fields.number }] },
    select: { slug: true, number: true },
  });
  if (clash) {
    return {
      status: "error",
      message:
        clash.slug === slug
          ? `The web address "${slug}" is already used by another room.`
          : `Room number "${fields.number}" already exists.`,
    };
  }

  // A new room needs its own physical space, or nothing would ever conflict
  // with it — the no-double-booking guarantee lives entirely on space claims.
  await prisma.$transaction(async (tx) => {
    const room = await tx.room.create({
      data: { ...fields, slug, description: fields.description || null },
    });
    const space = await tx.space.create({ data: { key: slug, label: fields.name } });
    await tx.roomSpace.create({ data: { roomId: room.id, spaceId: space.id } });
  });

  revalidatePath("/admin/rooms");
  revalidatePath("/");
  return { status: "success", message: `Created ${fields.name}. Add a photo next.` };
}

export async function uploadRoomImageAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const auth = await guard();
  if (isDenied(auth)) return auth;

  const slug = str(formData.get("slug"));
  const alt = str(formData.get("alt"));
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Choose an image to upload." };
  }
  if (alt.length < 3) {
    return {
      status: "error",
      message: "Describe the photo first — the description is read aloud by screen readers.",
      fields: { alt: "Required" },
    };
  }

  const room = await prisma.room.findUnique({
    where: { slug },
    select: { id: true, images: { select: { sortOrder: true } } },
  });
  if (!room) return { status: "error", message: "That room no longer exists." };

  let stored;
  try {
    stored = await putRoomImage(slug, file);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Upload failed." };
  }

  const nextOrder = room.images.reduce((max, i) => Math.max(max, i.sortOrder), -1) + 1;
  await prisma.roomImage.create({
    data: { roomId: room.id, url: stored.url, alt, kind: "PHOTO", sortOrder: nextOrder },
  });

  revalidatePath("/admin/rooms");
  revalidatePath(`/rooms/${slug}`);
  revalidatePath("/");
  return { status: "success", message: "Photo added." };
}

export async function updateImageAltAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const auth = await guard();
  if (isDenied(auth)) return auth;

  const parsed = imageMetaSchema.safeParse({
    imageId: str(formData.get("imageId")),
    alt: str(formData.get("alt")),
  });
  if (!parsed.success) {
    return { status: "error", message: "Check the highlighted fields.", fields: fieldErrors(parsed.error) };
  }

  const image = await prisma.roomImage.update({
    where: { id: parsed.data.imageId },
    data: { alt: parsed.data.alt },
    select: { room: { select: { slug: true } } },
  });

  revalidatePath("/admin/rooms");
  revalidatePath(`/rooms/${image.room.slug}`);
  return { status: "success", message: "Description saved." };
}

export async function moveImageAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const auth = await guard();
  if (isDenied(auth)) return auth;

  const imageId = str(formData.get("imageId"));
  const direction = str(formData.get("direction")) === "up" ? -1 : 1;

  const image = await prisma.roomImage.findUnique({
    where: { id: imageId },
    select: { id: true, roomId: true, sortOrder: true, room: { select: { slug: true } } },
  });
  if (!image) return { status: "error", message: "That image no longer exists." };

  const siblings = await prisma.roomImage.findMany({
    where: { roomId: image.roomId, kind: "PHOTO" },
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });
  const index = siblings.findIndex((s) => s.id === image.id);
  const target = index + direction;
  if (index === -1 || target < 0 || target >= siblings.length) {
    return { status: "idle" };
  }

  // Rewrite the whole run rather than swapping two values: seeded rows can share
  // or skip sort orders, and a swap would quietly do nothing there.
  const reordered = [...siblings];
  const [moved] = reordered.splice(index, 1);
  reordered.splice(target, 0, moved);

  await prisma.$transaction(
    reordered.map((row, order) =>
      prisma.roomImage.update({ where: { id: row.id }, data: { sortOrder: order } }),
    ),
  );

  revalidatePath("/admin/rooms");
  revalidatePath(`/rooms/${image.room.slug}`);
  revalidatePath("/");
  return { status: "success", message: "Order updated." };
}

export async function deleteImageAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const auth = await guard();
  if (isDenied(auth)) return auth;

  const imageId = str(formData.get("imageId"));
  const image = await prisma.roomImage.findUnique({
    where: { id: imageId },
    select: { id: true, url: true, room: { select: { slug: true } } },
  });
  if (!image) return { status: "error", message: "That image no longer exists." };

  await prisma.roomImage.delete({ where: { id: imageId } });
  // Seeded artwork stays on disk so a re-seed can restore it; uploads do not.
  if (isManagedUpload(image.url)) await deleteRoomImage(image.url);

  revalidatePath("/admin/rooms");
  revalidatePath(`/rooms/${image.room.slug}`);
  revalidatePath("/");
  return { status: "success", message: "Photo removed." };
}

export async function saveStaffMemberAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const auth = await guard();
  if (isDenied(auth)) return auth;

  const parsed = staffMemberSchema.safeParse({
    email: str(formData.get("email")),
    name: str(formData.get("name")),
    role: str(formData.get("role")),
    note: str(formData.get("note")),
  });
  if (!parsed.success) {
    return { status: "error", message: "Check the highlighted fields.", fields: fieldErrors(parsed.error) };
  }

  const email = parsed.data.email.toLowerCase();
  const data = {
    name: parsed.data.name || null,
    role: parsed.data.role,
    note: parsed.data.note || null,
  };

  await prisma.staffMember.upsert({
    where: { email },
    update: data,
    create: { ...data, email, addedBy: auth.email },
  });

  revalidatePath("/admin/people");
  revalidatePath("/", "layout");
  return {
    status: "success",
    message: `${email} can now ${parsed.data.role === "ADMIN" ? "manage rooms and access" : "review reservations"}.`,
  };
}

export async function removeStaffMemberAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const auth = await guard();
  if (isDenied(auth)) return auth;

  const email = str(formData.get("email")).toLowerCase();
  if (!email) return { status: "error", message: "Unrecognised request." };

  if (email === auth.email) {
    return { status: "error", message: "You cannot remove your own access." };
  }
  if (isBootstrapAdmin(email)) {
    return {
      status: "error",
      message: `${email} is an admin via the ADMIN_EMAILS setting. Remove it there and redeploy.`,
    };
  }

  const member = await prisma.staffMember.findUnique({ where: { email } });
  if (!member) return { status: "error", message: "They no longer have access." };

  // Never remove the last admin, counting the environment bootstrap.
  if (member.role === "ADMIN") {
    const admins = await prisma.staffMember.count({ where: { role: "ADMIN" } });
    if (admins <= 1 && bootstrapAdminEmails().length === 0) {
      return { status: "error", message: "That is the only admin. Add another one first." };
    }
  }

  await prisma.staffMember.delete({ where: { email } });

  revalidatePath("/admin/people");
  revalidatePath("/", "layout");
  return { status: "success", message: `Removed access for ${email}.` };
}
