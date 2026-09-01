"use client";

import Link from "next/link";
import { useId, useState } from "react";

import {
  PLAN_BUILDINGS,
  PLAN_CIRCULATION,
  PLAN_CONTEXT,
  PLAN_KIOSK,
  PLAN_ROOMS,
  PLAN_VIEWBOX,
  centroid,
  toPointsAttr,
  type PlanShape,
} from "./geometry";

export type PlanStatus = "free" | "busy" | "closed";

export type PlanRoomInfo = {
  slug: string;
  number: string;
  name: string;
  capacity: number;
  status?: PlanStatus;
};

type Props = {
  rooms: PlanRoomInfo[];
  /** Draws this room as the current one and drops its link. */
  selectedSlug?: string;
  /** Static mode is for the room detail page: highlight only, no navigation. */
  interactive?: boolean;
  className?: string;
};

const STATUS_FILL: Record<PlanStatus, string> = {
  free: "var(--free-soft)",
  busy: "var(--busy-soft)",
  closed: "var(--plan-context)",
};

const STATUS_STROKE: Record<PlanStatus, string> = {
  free: "var(--free)",
  busy: "var(--busy)",
  closed: "var(--plan-line)",
};

const COMMONS_KEY = "commons";

export function FloorPlan({ rooms, selectedSlug, interactive = true, className }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  const titleId = useId();
  const bySlug = new Map(rooms.map((room) => [room.slug, room]));

  const commons = PLAN_ROOMS.find((shape) => shape.key === COMMONS_KEY);
  const pods = PLAN_ROOMS.filter((shape) => shape.key !== COMMONS_KEY);

  function shapeStyle(shape: PlanShape) {
    const info = shape.slug ? bySlug.get(shape.slug) : undefined;
    const isSelected = shape.slug != null && shape.slug === selectedSlug;
    const isHovered = shape.key === hovered;

    if (isSelected) {
      return { fill: "var(--accent)", opacity: 0.18, stroke: "var(--accent)", width: 2.5 };
    }
    if (isHovered) {
      return { fill: "var(--brand)", opacity: 0.18, stroke: "var(--brand)", width: 2 };
    }
    if (info?.status) {
      return {
        fill: STATUS_FILL[info.status],
        opacity: 1,
        stroke: STATUS_STROKE[info.status],
        width: 1.1,
      };
    }
    return { fill: "var(--surface-raised)", opacity: 1, stroke: "var(--plan-line)", width: 1.1 };
  }

  function renderRoom(shape: PlanShape) {
    const info = shape.slug ? bySlug.get(shape.slug) : undefined;
    const [cx, cy] = centroid(shape);
    const style = shapeStyle(shape);
    const isCommons = shape.key === COMMONS_KEY;

    const body = (
      <>
        {/*
          One interpolated string, not several children. React treats <title>
          as document metadata and only serialises a single text child, so
          `{a} · {b}` renders empty on the server and full on the client — a
          hydration mismatch that takes the whole page's interactivity down.
        */}
        {info && <title>{`${info.name} · seats ${info.capacity}`}</title>}
        <polygon
          points={toPointsAttr(shape.points)}
          fill={style.fill}
          fillOpacity={style.opacity}
          stroke={style.stroke}
          strokeWidth={style.width}
          style={{ transition: "fill 120ms ease, stroke 120ms ease" }}
        />
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={isCommons ? 15 : 12}
          fontWeight={600}
          fill={info ? "var(--text)" : "var(--text-faint)"}
          pointerEvents="none"
        >
          {shape.label}
        </text>
      </>
    );

    if (!interactive || !info || shape.slug === selectedSlug) {
      return <g key={shape.key}>{body}</g>;
    }

    return (
      <Link
        key={shape.key}
        href={`/rooms/${info.slug}`}
        onMouseEnter={() => setHovered(shape.key)}
        onMouseLeave={() => setHovered(null)}
        onFocus={() => setHovered(shape.key)}
        onBlur={() => setHovered(null)}
        aria-label={`${info.name}, seats ${info.capacity}`}
        className="cursor-pointer"
      >
        {body}
      </Link>
    );
  }

  return (
    <figure className={className}>
      <svg
        viewBox={`0 0 ${PLAN_VIEWBOX.width} ${PLAN_VIEWBOX.height}`}
        role="img"
        aria-labelledby={titleId}
        className="h-auto w-full"
      >
        <title id={titleId}>
          Floor plan of the JAG-Ed Center and the ATB C State Building wing, showing the
          reservable rooms
        </title>

        {/* Corridor floor first — it runs under everything and ties the two wings together. */}
        {PLAN_CIRCULATION.map((band, index) => (
          <polygon
            key={`corridor-${index}`}
            points={toPointsAttr(band)}
            fill="var(--plan-fill)"
            stroke="none"
          />
        ))}

        {/*
          Order matters. The commons polygon encloses the pods and the kiosk, so
          it has to be painted before them or it would hide them.
        */}
        {commons && (
          <polygon points={toPointsAttr(commons.points)} fill="var(--plan-fill)" stroke="none" />
        )}
        {commons && renderRoom(commons)}

        {PLAN_CONTEXT.map((shape) => {
          const [cx, cy] = centroid(shape);
          return (
            <g key={shape.key}>
              <polygon
                points={toPointsAttr(shape.points)}
                fill="var(--plan-context)"
                stroke="var(--plan-line)"
                strokeWidth={1.1}
              />
              <text
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={11}
                fill="var(--text-faint)"
              >
                {shape.label}
              </text>
            </g>
          );
        })}

        <circle
          cx={PLAN_KIOSK.cx}
          cy={PLAN_KIOSK.cy}
          r={PLAN_KIOSK.r}
          fill="var(--plan-context)"
          stroke="var(--plan-line)"
          strokeWidth={1.1}
        />
        <text
          x={PLAN_KIOSK.cx}
          y={PLAN_KIOSK.cy}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={8}
          fill="var(--text-faint)"
        >
          {PLAN_KIOSK.label}
        </text>

        {pods.map(renderRoom)}

        {PLAN_BUILDINGS.map((building) => (
          <text
            key={building.label}
            x={building.at[0]}
            y={building.at[1]}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={12}
            fontWeight={600}
            letterSpacing={0.4}
            fill="var(--text-muted)"
            pointerEvents="none"
          >
            {building.label}
          </text>
        ))}
      </svg>
    </figure>
  );
}
