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
      className={`relative overflow-hidden rounded-lg border px-3.5 py-3 text-sm shadow-sm ${tone.container}`}
    >
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden="true"
          className={`mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full ${tone.iconWrap}`}
        >
          <ToneIcon variant={variant} className={tone.icon} />
        </span>
        <div className="min-w-0 flex-1 leading-snug">
          {title && (
            <p className={`text-sm font-semibold tracking-tight ${tone.title}`}>
              {title}
            </p>
          )}
          <p
            className={`${title ? "mt-1 " : ""}whitespace-pre-line ${tone.message}`}
          >
            {message}
          </p>
          {detail && (
            <div className={`mt-2 ${tone.message}`}>{detail}</div>
          )}
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label={dismissLabel}
            className={`-mr-0.5 -mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md transition-colors ${tone.dismiss} focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent`}
          >
            <DismissGlyph />
          </button>
        )}
      </div>
      {shouldAutoDismiss && !reduceMotion ? (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-0 bottom-0 h-[2px] ${tone.progressTrack}`}
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
        container:
          "border-emerald-200/70 bg-emerald-50/65 dark:border-emerald-800/45 dark:bg-emerald-950/25",
        title: "text-emerald-950 dark:text-emerald-50",
        message: "text-emerald-900 dark:text-emerald-100",
        iconWrap:
          "bg-emerald-100/70 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200",
        icon: "size-3.5",
        dismiss:
          "text-emerald-800/70 hover:bg-emerald-100/80 hover:text-emerald-950 focus-visible:ring-emerald-600 dark:text-emerald-100/70 dark:hover:bg-emerald-900/50 dark:hover:text-emerald-50 dark:focus-visible:ring-emerald-400",
        progressTrack: "bg-emerald-200/40 dark:bg-emerald-900/35",
        progressBar: "bg-emerald-500/55 dark:bg-emerald-400/40",
      };
    case "warning":
      return {
        container:
          "border-amber-200/70 bg-amber-50/65 dark:border-amber-800/45 dark:bg-amber-950/25",
        title: "text-amber-950 dark:text-amber-50",
        message: "text-amber-900 dark:text-amber-100",
        iconWrap:
          "bg-amber-100/70 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200",
        icon: "size-3.5",
        dismiss:
          "text-amber-800/70 hover:bg-amber-100/80 hover:text-amber-950 focus-visible:ring-amber-600 dark:text-amber-100/70 dark:hover:bg-amber-900/50 dark:hover:text-amber-50 dark:focus-visible:ring-amber-400",
        progressTrack: "bg-amber-200/40 dark:bg-amber-900/35",
        progressBar: "bg-amber-500/55 dark:bg-amber-400/40",
      };
    case "error":
      return {
        container:
          "border-rose-200/70 bg-rose-50/60 dark:border-rose-900/40 dark:bg-rose-950/22",
        title: "text-red-950 dark:text-rose-50",
        message: "text-red-900 dark:text-rose-100",
        iconWrap:
          "bg-rose-100/70 text-red-700 dark:bg-rose-900/40 dark:text-rose-200",
        icon: "size-3.5",
        dismiss:
          "text-red-800/70 hover:bg-rose-100/80 hover:text-red-950 focus-visible:ring-rose-600 dark:text-rose-100/70 dark:hover:bg-rose-900/45 dark:hover:text-rose-50 dark:focus-visible:ring-rose-400",
        progressTrack: "bg-rose-200/40 dark:bg-rose-900/35",
        progressBar: "bg-rose-500/50 dark:bg-rose-400/35",
      };
    case "info":
      return {
        container:
          "border-sky-200/70 bg-sky-50/65 dark:border-sky-800/45 dark:bg-sky-950/25",
        title: "text-sky-950 dark:text-sky-50",
        message: "text-sky-900 dark:text-sky-100",
        iconWrap:
          "bg-sky-100/70 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200",
        icon: "size-3.5",
        dismiss:
          "text-sky-800/70 hover:bg-sky-100/80 hover:text-sky-950 focus-visible:ring-sky-600 dark:text-sky-100/70 dark:hover:bg-sky-900/50 dark:hover:text-sky-50 dark:focus-visible:ring-sky-400",
        progressTrack: "bg-sky-200/40 dark:bg-sky-900/35",
        progressBar: "bg-sky-500/55 dark:bg-sky-400/40",
      };
  }
}
