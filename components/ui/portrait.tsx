// Raish's studio headshot (PROFILE.photo). Server component; next/image serves AVIF/WebP at the right size.
// Small avatars sit next to the visible name, so they are decorative (alt=""); the large portrait carries the alt text.
import Image from "next/image";
import { PROFILE } from "@/lib/profile";
import { cn } from "@/lib/utils";

export function Portrait({
  size,
  decorative = false,
  className,
  sizes,
}: {
  /** Rendered CSS size in px (square). */
  size: number;
  decorative?: boolean;
  className?: string;
  sizes?: string;
}) {
  return (
    <Image
      src={PROFILE.photo.src}
      alt={decorative ? "" : PROFILE.photo.alt}
      width={size}
      height={size}
      sizes={sizes ?? `${size}px`}
      quality={85}
      className={cn("shrink-0 object-cover", className)}
    />
  );
}
