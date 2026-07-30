import type { ReactNode, SVGProps } from "react";

/**
 * Canonical action-icon mapping for Portal commands.
 * Icons are decorative when a visible text label is present (`aria-hidden`).
 * Icon-only buttons must supply an accessible name (and normally a tooltip).
 */
export type PortalActionIconKind = "create" | "refresh" | "export" | "delete";

const iconClassName = "size-4 shrink-0";

export function PortalActionIcon({
  kind,
}: {
  kind: PortalActionIconKind;
}) {
  switch (kind) {
    case "create":
      return <PlusGlyph />;
    case "refresh":
      return <RefreshGlyph />;
    case "export":
      return <DownloadGlyph />;
    case "delete":
      return <TrashGlyph />;
  }
}

/** Renders the canonical icon before a visible action label. */
export function portalActionContent(
  kind: PortalActionIconKind,
  label: ReactNode,
): ReactNode {
  return (
    <>
      <PortalActionIcon kind={kind} />
      {label}
    </>
  );
}

function PlusGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      className={iconClassName}
    >
      <path d="M10 4v12M4 10h12" />
    </svg>
  );
}

function RefreshGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={iconClassName}
    >
      <path d="M15.5 6.5V3m0 0H12M15.5 3A7 7 0 1 0 17 11" />
    </svg>
  );
}

function DownloadGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={iconClassName}
    >
      <path d="M10 3v10m0 0 3.5-3.5M10 13 6.5 9.5M4 16.5h12" />
    </svg>
  );
}

function TrashGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={iconClassName}
      {...props}
    >
      <path d="M4.5 6h11M8 6V4.5h4V6m-6.5 0 .7 9.5h7.6L14.5 6" />
    </svg>
  );
}
