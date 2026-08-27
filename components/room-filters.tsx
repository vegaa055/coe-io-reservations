"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

type AmenityOption = { key: string; label: string };

const TYPES = [
  { value: "MEETING", label: "Meeting" },
  { value: "CONFERENCE", label: "Conference" },
  { value: "ADAPTABLE", label: "Adaptable" },
];

const SEATS = [
  { value: "5", label: "5+" },
  { value: "9", label: "9+" },
  { value: "16", label: "16+" },
];

export function RoomFilters({ amenities }: { amenities: AmenityOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const update = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (value === null || next.get(key) === value) next.delete(key);
      else next.set(key, value);
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const activeType = params.get("type");
  const activeSeats = params.get("seats");
  const activeAmenity = params.get("amenity");
  const freeNow = params.get("free") === "1";
  const hasFilters = Boolean(activeType || activeSeats || activeAmenity || freeNow);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-raised p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-16 shrink-0 text-xs font-medium uppercase tracking-wide text-faint">
          Type
        </span>
        {TYPES.map((option) => (
          <FilterChip
            key={option.value}
            active={activeType === option.value}
            onClick={() => update("type", option.value)}
          >
            {option.label}
          </FilterChip>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="w-16 shrink-0 text-xs font-medium uppercase tracking-wide text-faint">
          Seats
        </span>
        {SEATS.map((option) => (
          <FilterChip
            key={option.value}
            active={activeSeats === option.value}
            onClick={() => update("seats", option.value)}
          >
            {option.label}
          </FilterChip>
        ))}
        <FilterChip active={freeNow} onClick={() => update("free", "1")}>
          Free right now
        </FilterChip>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="w-16 shrink-0 text-xs font-medium uppercase tracking-wide text-faint">
          Has
        </span>
        <select
          value={activeAmenity ?? ""}
          onChange={(event) => update("amenity", event.target.value || null)}
          className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm"
        >
          <option value="">Any equipment</option>
          {amenities.map((amenity) => (
            <option key={amenity.key} value={amenity.key}>
              {amenity.label}
            </option>
          ))}
        </select>

        {hasFilters && (
          <button
            type="button"
            onClick={() => router.replace(pathname, { scroll: false })}
            className="ml-auto rounded-lg px-3 py-1.5 text-sm text-muted underline-offset-2 hover:text-ink hover:underline"
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
        active
          ? "border-brand bg-brand text-on-brand"
          : "border-line bg-surface text-muted hover:border-line-strong hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
