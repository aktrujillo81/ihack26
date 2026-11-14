"use client";

import "./ui.css";

export interface SegmentedOption<V extends string> {
  value: V;
  /** Already-translated text (the caller passes `t(...)`). */
  label: string;
}

/**
 * Joined buttons for choosing one option (a filter or a tab). Each segment is a
 * button with `aria-pressed`; the pressed one is ink with white text, so it
 * differs by fill and by the attribute, not by color alone. The group needs a
 * name (`label`) for screen readers.
 */
export function SegmentedControl<V extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly SegmentedOption<V>[];
  value: V;
  onChange: (value: V) => void;
}) {
  return (
    <div role="group" aria-label={label} className="ww-segmented">
      {options.map((option) => (
        <button key={option.value} type="button" aria-pressed={option.value === value} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}
