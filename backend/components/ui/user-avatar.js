"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

function getInitials(label) {
  const parts = String(label || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (!parts.length) {
    return "U"
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("")
}

export function UserAvatar({ src, label, className, imageClassName, fallbackClassName }) {
  const normalizedSrc = typeof src === "string" ? src.trim() : ""
  const [failedSrc, setFailedSrc] = useState("")
  const showImage = Boolean(normalizedSrc) && failedSrc !== normalizedSrc

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-sky-500 to-indigo-500 text-xs font-semibold text-white",
        className,
      )}
    >
      {showImage ? (
        <img
          src={normalizedSrc}
          alt={label || "Avatar"}
          referrerPolicy="no-referrer"
          onError={() => setFailedSrc(normalizedSrc)}
          className={cn("h-full w-full object-cover", imageClassName)}
        />
      ) : (
        <span className={fallbackClassName}>{getInitials(label)}</span>
      )}
    </div>
  )
}
