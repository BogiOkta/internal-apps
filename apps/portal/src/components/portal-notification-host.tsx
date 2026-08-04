"use client";

import { Children, type ReactNode } from "react";

/**
 * Shared top-center overlay host for transient operational PortalNotification
 * feedback. Centers relative to the authenticated work area (beside the
 * desktop sidebar), overlays content without layout shift, and preserves
 * pointer interaction for dismiss / hover pause / focus pause.
 *
 * Feature pages render PortalNotification children here. Do not place
 * operation feedback in detailsNotification, page-local banners, or
 * scrolling grid content. ConfirmDialog remains a separate control.
 */
export function PortalNotificationHost({
  children,
}: {
  children?: ReactNode;
}) {
  const items = Children.toArray(children).filter(Boolean);
  if (items.length === 0) {
    return null;
  }

  return (
    <div
      data-portal-notification-host="true"
      className="pointer-events-none fixed inset-x-0 top-[8.5rem] z-30 flex justify-center px-4 sm:px-6 lg:left-[240px] lg:top-[7.5rem] lg:px-7"
    >
      <div className="portal-notification-host-stack pointer-events-auto flex w-full max-w-[560px] flex-col gap-2">
        {items}
      </div>
    </div>
  );
}
