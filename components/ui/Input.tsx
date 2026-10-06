"use client";
import { useId, type InputHTMLAttributes } from "react";
export default function Input({
  label,
  hint,
  error,
  id,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
}) {
  const generated = useId();
  const fieldId = id || generated;
  return (
    <div className="space-y-2">
      <label htmlFor={fieldId} className="block text-sm font-semibold">
        {label}
      </label>
      <input
        {...props}
        id={fieldId}
        className={`ui-input ${className}`}
        aria-invalid={Boolean(error)}
        aria-describedby={error || hint ? `${fieldId}-hint` : undefined}
      />
      {(error || hint) && (
        <p
          id={`${fieldId}-hint`}
          className={error ? "text-sm text-rose-300" : "text-sm ui-muted"}
        >
          {error || hint}
        </p>
      )}
    </div>
  );
}
