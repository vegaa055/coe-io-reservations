"use client";

import Image from "next/image";
import { useState } from "react";

export type GalleryImage = { id: string; url: string; alt: string };

export function Gallery({ images }: { images: GalleryImage[] }) {
  const [active, setActive] = useState(0);

  if (images.length === 0) {
    return (
      <div className="flex aspect-[16/9] items-center justify-center rounded-xl border border-dashed border-line-strong bg-sunken text-sm text-faint">
        No photo of this room yet
      </div>
    );
  }

  const current = images[Math.min(active, images.length - 1)];

  return (
    <div className="flex flex-col gap-2">
      <div className="relative aspect-[16/9] overflow-hidden rounded-xl border border-line bg-sunken">
        <Image
          src={current.url}
          alt={current.alt}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 40rem"
          className="object-cover"
        />
      </div>

      {images.length > 1 && (
        <ul className="flex gap-2">
          {images.map((image, index) => (
            <li key={image.id}>
              <button
                type="button"
                onClick={() => setActive(index)}
                aria-label={image.alt}
                aria-current={index === active}
                className={`relative block h-16 w-24 overflow-hidden rounded-lg border-2 transition-colors ${
                  index === active ? "border-brand" : "border-line hover:border-line-strong"
                }`}
              >
                <Image src={image.url} alt="" fill sizes="6rem" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
