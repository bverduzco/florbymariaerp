// src/components/asset-image.tsx
//
// AssetImage — Cloudinary URL builder component (no upload, no Prisma).
//
// Usage:
//   <AssetImage publicId="Matilde_Ramo_Mini.png" alt="Peachy Bouquet" />
//   <AssetImage publicId="Matilde_Ramo_Mini.png" width={120} height={120} variant="thumb" />
//   <AssetImage publicId="Matilde_Ramo_Mini.png" variant="hero" className="w-full" />
//
// Cloud name comes from env: NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
// (NEXT_PUBLIC_ prefix makes it available in the browser).
//
// URL pattern:
//   https://res.cloudinary.com/<cloud>/image/upload/<transformations>/<public_id>
//
// Examples generated:
//   thumb:  c_fill,w_200,h_200,q_auto,f_auto  → 200×200 square
//   card:   c_fill,w_400,h_300,q_auto,f_auto  → 4:3 card
//   hero:   c_fit,w_800,h_600,q_auto,f_auto   → letterboxed
//   full:   q_auto,f_auto                       → original aspect

import { cn } from "@/lib/utils"

type Variant = "thumb" | "card" | "hero" | "full" | "square"

const VARIANT_TRANSFORMS: Record<Variant, string> = {
  thumb: "c_fill,w_200,h_200,q_auto,f_auto",
  card: "c_fill,w_400,h_300,q_auto,f_auto",
  hero: "c_fit,w_800,h_600,q_auto,f_auto",
  square: "c_fill,w_600,h_600,q_auto,f_auto",
  full: "q_auto,f_auto",
}

interface AssetImageProps {
  /** Cloudinary public_id (with or without file extension) */
  publicId: string
  /** Alt text for accessibility */
  alt: string
  /** Visual variant — picks transformation preset */
  variant?: Variant
  /** Override width (px). Overrides variant default. */
  width?: number
  /** Override height (px). Overrides variant default. */
  height?: number
  /** Custom Cloudinary transformation string (overrides variant) */
  transform?: string
  /** Additional CSS classes */
  className?: string
  /** Loading strategy */
  loading?: "lazy" | "eager"
}

function buildCloudinaryUrl(
  cloudName: string,
  publicId: string,
  transform: string,
): string {
  // Public_id may include extension (.png, .jpg). Cloudinary handles both.
  return `https://res.cloudinary.com/${cloudName}/image/upload/${transform}/${publicId}`
}

export function AssetImage({
  publicId,
  alt,
  variant = "card",
  width,
  height,
  transform,
  className,
  loading = "lazy",
}: AssetImageProps) {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME

  if (!cloudName) {
    // Hard fallback so the demo works even without env configured.
    // In production this would be a build error.
    console.warn(
      "[AssetImage] NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME is not set. " +
        "Using default 'mvtqdpen' for demo purposes.",
    )
  }

  const resolvedCloud = cloudName ?? "mvtqdpen"

  // Build transformation string
  let transformString = transform
  if (!transformString) {
    if (width && height) {
      transformString = `c_fill,w_${width},h_${height},q_auto,f_auto`
    } else if (width) {
      transformString = `c_fit,w_${width},q_auto,f_auto`
    } else if (height) {
      transformString = `c_fit,h_${height},q_auto,f_auto`
    } else {
      transformString = VARIANT_TRANSFORMS[variant]
    }
  }

  const url = buildCloudinaryUrl(resolvedCloud, publicId, transformString)

  // Compute display dimensions for the <img> tag (these don't have to match
  // the URL transformation exactly — the URL controls the asset bytes,
  // these control the rendered box size).
  const displayWidth = width ?? (variant === "thumb" ? 200 : variant === "card" ? 400 : variant === "hero" ? 800 : variant === "square" ? 600 : undefined)
  const displayHeight = height ?? (variant === "thumb" ? 200 : variant === "card" ? 300 : variant === "hero" ? 600 : variant === "square" ? 600 : undefined)

  return (
    <img
      src={url}
      alt={alt}
      width={displayWidth}
      height={displayHeight}
      loading={loading}
      className={cn("object-cover", className)}
    />
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Helper: build a Cloudinary URL without rendering (useful for <meta og:image>)
// ────────────────────────────────────────────────────────────────────────────

export function buildAssetUrl(
  publicId: string,
  variant: Variant = "card",
  cloudName?: string,
): string {
  const cloud = cloudName ?? process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "mvtqdpen"
  return buildCloudinaryUrl(cloud, publicId, VARIANT_TRANSFORMS[variant])
}
