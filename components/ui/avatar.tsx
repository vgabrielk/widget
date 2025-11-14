"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"
import { DEFAULT_AVATAR } from "@/lib/utils/avatar"

function Avatar({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(
        "relative flex size-8 shrink-0 overflow-hidden rounded-full",
        className
      )}
      {...props}
    />
  )
}

type AvatarImageProps = React.ComponentProps<typeof AvatarPrimitive.Image> & {
  fallbackSrc?: string
  avatarPath?: string | null
}

function AvatarImage({
  className,
  fallbackSrc = DEFAULT_AVATAR,
  avatarPath,
  onError,
  ...props
}: AvatarImageProps) {
  const src = props.src

  const handleError = React.useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      const target = event.currentTarget
      if (target.dataset.fallbackApplied === "true") {
        if (onError) onError(event)
        return
      }

      target.dataset.fallbackApplied = "true"
      target.src = fallbackSrc
      console.warn("Avatar not found at path:", avatarPath || src || "[unknown]")

      if (onError) {
        onError(event)
      }
    },
    [avatarPath, fallbackSrc, onError, src]
  )

  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full", className)}
      onError={handleError}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "bg-muted flex size-full items-center justify-center rounded-full",
        className
      )}
      {...props}
    />
  )
}

export { Avatar, AvatarImage, AvatarFallback }
