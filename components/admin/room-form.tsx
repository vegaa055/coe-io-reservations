"use client";

import { useActionState, useState } from "react";

import { createRoomAction, updateRoomAction } from "@/app/admin/actions";
import { idleState, type AdminState } from "@/lib/admin-state";

import {
  ActionResult,
  Field,
  SubmitButton,
  WEEKDAYS,
  fieldError,
  inputClass,
  minutesToTime,
} from "./form-bits";

export type RoomFormValues = {
  slug: string;
  name: string;
  number: string;
  building: string;
  type: "MEETING" | "CONFERENCE" | "ADAPTABLE";
  summary: string;
  description: string | null;
  capacity: number;
  maxOccupancy: number | null;
  widthFt: number | null;
  lengthFt: number | null;
  isBookable: boolean;
  needsApproval: boolean;
  openMinute: number;
  closeMinute: number;
  openDays: number[];
  minMinutes: number;
  maxMinutes: number;
  advanceDays: number;
  sortOrder: number;
};

export const BLANK_ROOM: RoomFormValues = {
  slug: "",
  name: "",
  number: "",
  building: "JAG-Ed Center",
  type: "MEETING",
  summary: "",
  description: "",
  capacity: 8,
  maxOccupancy: null,
  widthFt: null,
  lengthFt: null,
  isBookable: true,
  needsApproval: false,
  openMinute: 420,
  closeMinute: 1200,
  openDays: [1, 2, 3, 4, 5],
  minMinutes: 30,
  maxMinutes: 240,
  advanceDays: 120,
  sortOrder: 100,
};

/**
 * Times are entered as <input type="time"> and posted as minutes-from-midnight,
 * which is how the Room row stores them. The hidden mirrors below are what
 * actually get submitted.
 */
export function RoomForm({
  mode,
  room,
  onDone,
}: {
  mode: "create" | "edit";
  room: RoomFormValues;
  onDone?: () => void;
}) {
  const action = mode === "create" ? createRoomAction : updateRoomAction;
  const [state, formAction, pending] = useActionState<AdminState, FormData>(
    async (prev, formData) => {
      const result = await action(prev, formData);
      if (result.status === "success") onDone?.();
      return result;
    },
    idleState,
  );

  const [open, setOpen] = useState(minutesToTime(room.openMinute));
  const [close, setClose] = useState(minutesToTime(room.closeMinute));

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {mode === "edit" && <input type="hidden" name="slug" value={room.slug} />}
      <input type="hidden" name="openMinute" value={timeValue(open)} />
      <input type="hidden" name="closeMinute" value={timeValue(close)} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" error={fieldError(state, "name")}>
          <input name="name" defaultValue={room.name} required className={inputClass} />
        </Field>
        <Field label="Room number" error={fieldError(state, "number")}>
          <input name="number" defaultValue={room.number} required className={inputClass} />
        </Field>
      </div>

      {mode === "create" && (
        <Field
          label="Web address"
          hint="Lowercase letters, numbers and hyphens. Used in the room's URL and cannot be changed later."
          error={fieldError(state, "slug")}
        >
          <input name="slug" placeholder="b161" required className={inputClass} />
        </Field>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Building" error={fieldError(state, "building")}>
          <input name="building" defaultValue={room.building} required className={inputClass} />
        </Field>
        <Field label="Type" error={fieldError(state, "type")}>
          <select name="type" defaultValue={room.type} className={inputClass}>
            <option value="MEETING">Meeting</option>
            <option value="CONFERENCE">Conference</option>
            <option value="ADAPTABLE">Adaptable</option>
          </select>
        </Field>
      </div>

      <Field
        label="Summary"
        hint="One line, shown on the room cards."
        error={fieldError(state, "summary")}
      >
        <input name="summary" defaultValue={room.summary} required className={inputClass} />
      </Field>

      <Field label="Description" error={fieldError(state, "description")}>
        <textarea
          name="description"
          rows={4}
          defaultValue={room.description ?? ""}
          className={inputClass}
        />
      </Field>

      <fieldset className="grid gap-4 sm:grid-cols-4">
        <legend className="mb-1 text-sm font-medium">Size</legend>
        <Field label="Seats" error={fieldError(state, "capacity")}>
          <input
            name="capacity"
            type="number"
            min={1}
            defaultValue={room.capacity}
            required
            className={inputClass}
          />
        </Field>
        <Field
          label="Max occupancy"
          hint="Optional"
          error={fieldError(state, "maxOccupancy")}
        >
          <input
            name="maxOccupancy"
            type="number"
            min={1}
            defaultValue={room.maxOccupancy ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Width (ft)" error={fieldError(state, "widthFt")}>
          <input
            name="widthFt"
            type="number"
            min={1}
            defaultValue={room.widthFt ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Length (ft)" error={fieldError(state, "lengthFt")}>
          <input
            name="lengthFt"
            type="number"
            min={1}
            defaultValue={room.lengthFt ?? ""}
            className={inputClass}
          />
        </Field>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-sm font-medium">Booking rules</legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Opens" error={fieldError(state, "openMinute")}>
            <input
              type="time"
              step={1800}
              value={open}
              onChange={(e) => setOpen(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Closes" error={fieldError(state, "closeMinute")}>
            <input
              type="time"
              step={1800}
              value={close}
              onChange={(e) => setClose(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <div>
          <span className="mb-1 block text-sm font-medium">Open days</span>
          <div className="flex flex-wrap gap-3">
            {WEEKDAYS.map((day) => (
              <label key={day.value} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  name="openDays"
                  value={day.value}
                  defaultChecked={room.openDays.includes(day.value)}
                />
                {day.label}
              </label>
            ))}
          </div>
          {fieldError(state, "openDays") && (
            <span role="alert" className="mt-1 block text-xs text-busy">
              {fieldError(state, "openDays")}
            </span>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Shortest (min)" error={fieldError(state, "minMinutes")}>
            <input
              name="minMinutes"
              type="number"
              min={15}
              step={15}
              defaultValue={room.minMinutes}
              className={inputClass}
            />
          </Field>
          <Field label="Longest (min)" error={fieldError(state, "maxMinutes")}>
            <input
              name="maxMinutes"
              type="number"
              min={15}
              step={15}
              defaultValue={room.maxMinutes}
              className={inputClass}
            />
          </Field>
          <Field label="Book ahead (days)" error={fieldError(state, "advanceDays")}>
            <input
              name="advanceDays"
              type="number"
              min={1}
              defaultValue={room.advanceDays}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isBookable" defaultChecked={room.isBookable} />
            Open for online reservations
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="needsApproval" defaultChecked={room.needsApproval} />
            Requests need staff approval before they are confirmed
          </label>
        </div>

        <Field
          label="Sort order"
          hint="Lower numbers appear first in the room list."
          error={fieldError(state, "sortOrder")}
        >
          <input
            name="sortOrder"
            type="number"
            min={0}
            defaultValue={room.sortOrder}
            className={`${inputClass} sm:max-w-32`}
          />
        </Field>
      </fieldset>

      <ActionResult state={state} />

      <div>
        <SubmitButton pending={pending}>
          {mode === "create" ? "Create room" : "Save changes"}
        </SubmitButton>
      </div>
    </form>
  );
}

function timeValue(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
