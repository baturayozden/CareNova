"use client";

import React, { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

// ─── types ────────────────────────────────────────────────────────────────────

type Variant = "primary" | "secondary" | "ghost";
type Size    = "sm" | "md" | "lg";

export interface AnimatedButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:  Variant;
  size?:     Size;
  icon?:     React.ReactNode;
  iconRight?: React.ReactNode;
  loading?:  boolean;
  href?:     string;
  children:  React.ReactNode;
}

// ─── size map ─────────────────────────────────────────────────────────────────

const sizeMap: Record<Size, string> = {
  sm: "px-5 py-2.5 text-sm  gap-1.5 rounded-xl",
  md: "px-7 py-3.5 text-base gap-2   rounded-xl",
  lg: "px-9 py-4   text-lg  gap-2.5  rounded-2xl",
};

// ─── variant styles ───────────────────────────────────────────────────────────

const variantBase: Record<Variant, string> = {
  primary:   "text-white font-semibold",
  secondary: "text-white     font-medium border border-white/10",
  ghost:     "text-gold       font-medium",
};

// ─── shimmer component ────────────────────────────────────────────────────────

function Shimmer() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
    >
      <span className="absolute inset-0 -translate-x-full animate-[shimmer_2.2s_ease_infinite] bg-gradient-to-r from-transparent via-white/25 to-transparent" />
    </span>
  );
}

// ─── glow halo ────────────────────────────────────────────────────────────────

function GlowHalo({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute -inset-px rounded-[inherit] transition-opacity duration-300"
      style={{
        opacity:    active ? 1 : 0,
        boxShadow: "0 0 0 2px rgba(37,99,235,0.55), 0 0 28px 4px rgba(37,99,235,0.35)",
      }}
    />
  );
}

// ─── spinner ──────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        className="opacity-25"
        cx="12" cy="12" r="10"
        stroke="currentColor" strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export const AnimatedButton = React.forwardRef<
  HTMLButtonElement,
  AnimatedButtonProps
>(
  (
    {
      variant  = "primary",
      size     = "md",
      icon,
      iconRight,
      loading  = false,
      href,
      children,
      className = "",
      disabled,
      onClick,
      ...rest
    },
    ref
  ) => {
    const reduced   = useReducedMotion();
    const [hovered, setHovered] = useState(false);
    const isDisabled = disabled || loading;

    // spring config
    const spring = { type: "spring" as const, stiffness: 420, damping: 18 };

    // background per variant
    const bgStyle: React.CSSProperties =
      variant === "primary"
        ? {
            background:
              "linear-gradient(135deg, #2563EB 0%, #3B82F6 50%, #1D4ED8 100%)",
            backgroundSize: "200% 200%",
          }
        : variant === "secondary"
        ? { background: "rgba(255,255,255,0.04)" }
        : { background: "transparent" };

    const baseClass = [
      "relative inline-flex items-center justify-center overflow-hidden",
      "select-none outline-none cursor-pointer",
      "transition-colors duration-200",
      "focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-navy-950",
      "disabled:opacity-40 disabled:pointer-events-none",
      sizeMap[size],
      variantBase[variant],
      className,
    ]
      .filter(Boolean)
      .join(" ");

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (href && !isDisabled) window.location.href = href;
      onClick?.(e);
    };

    return (
      <motion.button
        ref={ref}
        // spring gestures
        whileHover={reduced ? {} : { scale: 1.045 }}
        whileTap={reduced   ? {} : { scale: 0.96  }}
        transition={spring}
        // glow box-shadow on hover (primary only)
        animate={
          variant === "primary" && hovered && !reduced
            ? { boxShadow: "0 0 42px rgba(37,99,235,0.55)" }
            : { boxShadow: "0 0 0px rgba(37,99,235,0)" }
        }
        // events
        onHoverStart={() => setHovered(true)}
        onHoverEnd={()   => setHovered(false)}
        onClick={handleClick}
        disabled={isDisabled}
        className={baseClass}
        style={bgStyle}
        aria-busy={loading}
        {...(rest as any)}
      >
        {/* shimmer sweep (primary only) */}
        {variant === "primary" && !reduced && <Shimmer />}

        {/* glow outline */}
        {variant === "primary" && <GlowHalo active={hovered} />}

        {/* content */}
        {loading ? (
          <Spinner />
        ) : (
          <>
            {icon     && <span className="shrink-0">{icon}</span>}
            <span>{children}</span>
            {iconRight && <span className="shrink-0">{iconRight}</span>}
          </>
        )}
      </motion.button>
    );
  }
);

AnimatedButton.displayName = "AnimatedButton";
