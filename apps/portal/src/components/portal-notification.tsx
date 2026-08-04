"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

export type PortalNotificationVariant =
  | "success"
  | "warning"
  | "error"
  | "info";

/**
 * Canonical default auto-dismiss durations for operation notifications.
 * Feature modules MUST NOT redefine local toast timers.
 */
export const PORTAL_NOTIFICATION_DEFAULT_DURATION_MS = {
  success: 5000,
  info: 6000,
  warning: 8000,
  error: 10000,
} as const satisfies Record<PortalNotificationVariant, number>;

/**
 * Canonical Portal operation-feedback notification.
 * Use for success, warning, error, and info results of page operations.
 * Do not use for field/form validation (those stay next to the field).
 * Do not use for pre-operation confirmation (`ConfirmDialog`).
 * Must be placed in a stable region that does not shift the primary grid.
 *
 * Transient mode (default when `onDismiss` is provided): auto-dismisses after
 * the variant default duration (or `durationMs`), pauses while hovered or
 * keyboard-focused, and offers an X-only dismiss control.
 * Persistent mode: pass `autoDismiss={false}`.
 */
export function PortalNotification({
  variant,
  message,
  title,
  detail,
  dismissLabel,
  onDismiss,
  autoDismiss,
  durationMs,
}: {
  variant: PortalNotificationVariant;
  message: string;
  title?: string;
  detail?: ReactNode;
  dismissLabel: string;
  onDismiss?: () => void;
  /**
   * When true, the notification auto-dismisses after `durationMs` or the
   * variant default. Defaults to true when `onDismiss` is provided.
   */
  autoDismiss?: boolean;
  /** Override the canonical variant default duration (milliseconds). */
  durationMs?: number;
}) {
  const isError = variant === "error";
  const isWarning = variant === "warning";
  const tone = toneClasses(variant);
  const shouldAutoDismiss = Boolean(onDismiss) && (autoDismiss ?? true);
  const totalMs =
    durationMs ?? PORTAL_NOTIFICATION_DEFAULT_DURATION_MS[variant];

  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const cardRef = useRef<HTMLDivElement | null>(null);
  const remainingRef = useRef(totalMs);
  const hoverPausedRef = useRef(false);
  const focusPausedRef = useRef(false);
  const reduceMotionRef = useRef(false);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(1);
  const [reduceMotion, setReduceMotion] = useState(false);
  reduceMotionRef.current = reduceMotion;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  // Own the dismiss timer with ref-driven pause/resume so hover and focus
  // reliably stop the countdown without depending on React state timing.
  useEffect(() => {
    if (!shouldAutoDismiss) {
      setProgress(1);
      return;
    }

    remainingRef.current = totalMs;
    hoverPausedRef.current = false;
    focusPausedRef.current = false;
    setPaused(false);
    setProgress(1);

    let timer: ReturnType<typeof setTimeout> | null = null;
    let raf: number | null = null;
    let segmentStartedAt = 0;
    let segmentBudget = 0;
    let cancelled = false;

    const clearScheduler = () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      if (raf !== null) {
        cancelAnimationFrame(raf);
        raf = null;
      }
    };

    const captureRemaining = () => {
      if (segmentBudget <= 0) return;
      const elapsed = performance.now() - segmentStartedAt;
      remainingRef.current = Math.max(0, segmentBudget - elapsed);
      segmentBudget = 0;
    };

    const arm = () => {
      clearScheduler();
      if (cancelled) return;
      if (hoverPausedRef.current || focusPausedRef.current) return;

      const budget = remainingRef.current;
      if (budget <= 0) {
        setProgress(0);
        onDismissRef.current?.();
        return;
      }

      segmentBudget = budget;
      segmentStartedAt = performance.now();
      timer = setTimeout(() => {
        remainingRef.current = 0;
        segmentBudget = 0;
        setProgress(0);
        onDismissRef.current?.();
      }, budget);

      if (reduceMotionRef.current) {
        setProgress(1);
        return;
      }

      const tick = () => {
        if (cancelled || hoverPausedRef.current || focusPausedRef.current) {
          return;
        }
        const elapsed = performance.now() - segmentStartedAt;
        const left = Math.max(0, segmentBudget - elapsed);
        remainingRef.current = left;
        setProgress(totalMs <= 0 ? 0 : left / totalMs);
        if (left > 0) {
          raf = requestAnimationFrame(tick);
        }
      };
      raf = requestAnimationFrame(tick);
    };

    const setHoverPaused = (value: boolean) => {
      if (hoverPausedRef.current === value) return;
      if (value) {
        captureRemaining();
        clearScheduler();
        hoverPausedRef.current = true;
      } else {
        hoverPausedRef.current = false;
        arm();
      }
      setPaused(hoverPausedRef.current || focusPausedRef.current);
    };

    const setFocusPaused = (value: boolean) => {
      if (focusPausedRef.current === value) return;
      if (value) {
        captureRemaining();
        clearScheduler();
        focusPausedRef.current = true;
      } else {
        focusPausedRef.current = false;
        arm();
      }
      setPaused(hoverPausedRef.current || focusPausedRef.current);
    };

    const node = cardRef.current;
    const onPointerEnter = () => setHoverPaused(true);
    const onPointerLeave = () => setHoverPaused(false);
    const onMouseEnter = () => setHoverPaused(true);
    const onMouseLeave = () => setHoverPaused(false);
    const onFocusIn = () => setFocusPaused(true);
    const onFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget;
      if (next instanceof Node && node?.contains(next)) {
        return;
      }
      setFocusPaused(false);
    };

    node?.addEventListener("pointerenter", onPointerEnter);
    node?.addEventListener("pointerleave", onPointerLeave);
    node?.addEventListener("mouseenter", onMouseEnter);
    node?.addEventListener("mouseleave", onMouseLeave);
    node?.addEventListener("focusin", onFocusIn);
    node?.addEventListener("focusout", onFocusOut);

    arm();

    return () => {
      cancelled = true;
      captureRemaining();
      clearScheduler();
      node?.removeEventListener("pointerenter", onPointerEnter);
      node?.removeEventListener("pointerleave", onPointerLeave);
      node?.removeEventListener("mouseenter", onMouseEnter);
      node?.removeEventListener("mouseleave", onMouseLeave);
      node?.removeEventListener("focusin", onFocusIn);
      node?.removeEventListener("focusout", onFocusOut);
    };
  }, [shouldAutoDismiss, totalMs, variant, message, title, detail]);

  return (
    <div
      ref={cardRef}
      role={isError || isWarning ? "alert" : "status"}
      aria-live={isError || isWarning ? "assertive" : "polite"}
      data-portal-notification-paused={paused ? "true" : "false"}
      className="relative overflow-hidden rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm shadow-md"
    >
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 w-1 ${tone.accent}`}
      />
      <div className="flex items-start gap-3 pl-1.5">
        <span
          aria-hidden="true"
          className={`mt-0.5 inline-flex size-5 shrink-0 items-center justify-center ${tone.icon}`}
        >
          <ToneIcon variant={variant} className="size-4" />
        </span>
        <div className="min-w-0 flex-1 leading-snug">
          {title && (
            <p className="text-[0.9375rem] font-semibold tracking-tight text-slate-950">
              {title}
            </p>
          )}
          <p
            className={`${title ? "mt-1 " : ""}whitespace-pre-line text-sm font-normal text-slate-600`}
          >
            {message}
          </p>
          {detail && (
            <div className="mt-2 text-sm font-normal text-slate-600">
              {detail}
            </div>
          )}
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label={dismissLabel}
            className="-mr-1 -mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent"
          >
            <DismissGlyph />
          </button>
        )}
      </div>
      {shouldAutoDismiss && !reduceMotion ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-slate-100"
        >
          <div
            className={`h-full origin-left ${tone.progressBar}`}
            style={
              {
                transform: `scaleX(${progress})`,
              } satisfies CSSProperties
            }
          />
        </div>
      ) : null}
    </div>
  );
}

function DismissGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      className="size-3.5"
    >
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}

function ToneIcon({
  variant,
  className,
}: {
  variant: PortalNotificationVariant;
  className: string;
}) {
  switch (variant) {
    case "success":
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
        >
          <path d="M5 10.5l3 3 7-7" />
        </svg>
      );
    case "warning":
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
        >
          <path d="M10 6.5v4.5M10 14h.01" />
          <path d="M9.05 3.9L2.6 15.1A1.1 1.1 0 0 0 3.55 16.7h12.9a1.1 1.1 0 0 0 .95-1.6L10.95 3.9a1.1 1.1 0 0 0-1.9 0Z" />
        </svg>
      );
    case "error":
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          className={className}
        >
          <circle cx="10" cy="10" r="7" />
          <path d="M10 6.5v4M10 13.5h.01" />
        </svg>
      );
    case "info":
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          className={className}
        >
          <circle cx="10" cy="10" r="7" />
          <path d="M10 9v4.5M10 6.5h.01" />
        </svg>
      );
  }
}

function toneClasses(variant: PortalNotificationVariant) {
  switch (variant) {
    case "success":
      return {
        accent: "bg-emerald-500",
        icon: "text-emerald-600",
        progressBar: "bg-emerald-500/70",
      };
    case "warning":
      return {
        accent: "bg-amber-500",
        icon: "text-amber-600",
        progressBar: "bg-amber-500/70",
      };
    case "error":
      return {
        accent: "bg-rose-500",
        icon: "text-rose-600",
        progressBar: "bg-rose-500/70",
      };
    case "info":
      return {
        accent: "bg-sky-500",
        icon: "text-sky-600",
        progressBar: "bg-sky-500/70",
      };
  }
}
