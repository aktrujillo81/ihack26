import type { ButtonHTMLAttributes } from "react";

import "./ui.css";

export type ButtonVariant = "primary" | "secondary" | "text";

/**
 * Primary (accent fill, one per view), secondary (white, control border) and
 * text (accent words). 40px high. The type defaults to "button" so a button
 * inside a form never submits it by accident. Prefer leaving a button enabled
 * and explaining, over `disabled` (style guide section 7).
 */
export function Button({
  variant = "secondary",
  type = "button",
  className,
  ...rest
}: { variant?: ButtonVariant } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const classes = ["ww-btn", variant === "secondary" ? "" : `ww-btn--${variant}`, className ?? ""].filter(Boolean).join(" ");
  return <button type={type} className={classes} {...rest} />;
}
