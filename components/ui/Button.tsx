import type { ButtonHTMLAttributes } from "react";
export default function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }) {
  return (
    <button type={type} className={`ui-button ui-button-${variant} ${className}`} {...props} />
  );
}
