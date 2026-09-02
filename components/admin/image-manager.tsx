"use client";

import Image from "next/image";
import { useActionState } from "react";

import {
  deleteImageAction,
  moveImageAction,
  updateImageAltAction,
  uploadRoomImageAction,
} from "@/app/admin/actions";
import { idleState } from "@/lib/admin-state";

import { ActionResult, Field, SubmitButton, inputClass } from "./form-bits";

export type AdminImage = {
  id: string;
  url: string;
  alt: string;
  kind: "PHOTO" | "PLAN";
  sortOrder: number;
};

export function ImageManager({
  slug,
  images,
  storageNote,
  storageDriver,
}: {
  slug: string;
  images: AdminImage[];
  storageNote: string;
  storageDriver: "blob" | "local";
}) {
  const photos = images.filter((i) => i.kind === "PHOTO");

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-sm font-semibold">Photos</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          The first photo is used as the card thumbnail. {storageNote}
        </p>
        {storageDriver === "local" && (
          <p className="mt-2 rounded-lg bg-pending-soft px-3 py-2 text-xs text-pending">
            Uploads are being written to the local project folder. Set
            BLOB_READ_WRITE_TOKEN before deploying, or they will fail in production.
          </p>
        )}
      </div>

      {photos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line-strong p-6 text-center text-sm text-muted">
          No photos yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {photos.map((image, index) => (
            <ImageRow
              key={image.id}
              image={image}
              isFirst={index === 0}
              isLast={index === photos.length - 1}
            />
          ))}
        </ul>
      )}

      <UploadForm slug={slug} />
    </div>
  );
}

function ImageRow({
  image,
  isFirst,
  isLast,
}: {
  image: AdminImage;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [altState, altAction, altPending] = useActionState(updateImageAltAction, idleState);
  const [, moveAction] = useActionState(moveImageAction, idleState);
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteImageAction,
    idleState,
  );

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-3 sm:flex-row">
      <div className="relative h-24 w-full shrink-0 overflow-hidden rounded-lg bg-sunken sm:w-40">
        <Image src={image.url} alt={image.alt} fill sizes="10rem" className="object-cover" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <form action={altAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="imageId" value={image.id} />
          <div className="min-w-48 flex-1">
            <Field label="Description" error={altState.status === "error" ? altState.fields?.alt : undefined}>
              <input name="alt" defaultValue={image.alt} className={inputClass} />
            </Field>
          </div>
          <SubmitButton pending={altPending} variant="quiet">
            Save
          </SubmitButton>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <form action={moveAction}>
            <input type="hidden" name="imageId" value={image.id} />
            <input type="hidden" name="direction" value="up" />
            <button
              type="submit"
              disabled={isFirst}
              className="rounded-lg border border-line px-2.5 py-1 text-xs disabled:opacity-40 hover:enabled:bg-sunken"
            >
              ↑ Earlier
            </button>
          </form>
          <form action={moveAction}>
            <input type="hidden" name="imageId" value={image.id} />
            <input type="hidden" name="direction" value="down" />
            <button
              type="submit"
              disabled={isLast}
              className="rounded-lg border border-line px-2.5 py-1 text-xs disabled:opacity-40 hover:enabled:bg-sunken"
            >
              ↓ Later
            </button>
          </form>
          <form action={deleteAction} className="ml-auto">
            <input type="hidden" name="imageId" value={image.id} />
            <button
              type="submit"
              disabled={deletePending}
              className="rounded-lg px-2.5 py-1 text-xs text-muted hover:text-busy disabled:opacity-60"
            >
              Remove
            </button>
          </form>
        </div>

        {altState.status === "error" && <ActionResult state={altState} />}
        {deleteState.status === "error" && <ActionResult state={deleteState} />}
      </div>
    </li>
  );
}

function UploadForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(uploadRoomImageAction, idleState);

  return (
    <form
      action={action}
      className="flex flex-col gap-3 rounded-xl border border-dashed border-line-strong p-4"
    >
      <input type="hidden" name="slug" value={slug} />
      <Field label="Add a photo">
        <input
          type="file"
          name="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          required
          className="w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-sm file:text-on-brand"
        />
      </Field>
      <Field
        label="Description"
        hint="Read aloud by screen readers — describe what is in the photo."
        error={state.status === "error" ? state.fields?.alt : undefined}
      >
        <input
          name="alt"
          placeholder="Room set up in rows facing the projector screen"
          required
          className={inputClass}
        />
      </Field>
      <ActionResult state={state} />
      <div>
        <SubmitButton pending={pending}>Upload</SubmitButton>
      </div>
    </form>
  );
}
