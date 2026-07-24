"use client";

import { useEffect, useId, useMemo, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import { FormField, formControlClassName } from "@/components/form-field";

export type ComboboxOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

export function SearchableCombobox({
  label, hint, error, value, options, placeholder, emptyText, clearLabel,
  disabled, readOnly, onChange,
}: {
  label: string; hint?: string; error?: string; value: string;
  options: ComboboxOption[]; placeholder: string; emptyText: string;
  clearLabel: string; disabled?: boolean; readOnly?: boolean;
  onChange: (value: string) => void;
}) {
  const generatedId = useId();
  const id = `combobox-${generatedId.replace(/:/g, "")}`;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return options.filter((option) => !normalized ||
      `${option.label} ${option.description ?? ""}`.toLocaleLowerCase().includes(normalized));
  }, [options, query]);
  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);

  function choose(option: ComboboxOption) {
    if (option.disabled) return;
    onChange(option.value); setQuery(""); setOpen(false);
  }

  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault(); setOpen(true);
      setActiveIndex((index) => nextEnabledIndex(filtered, index, 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault(); setOpen(true);
      setActiveIndex((index) => nextEnabledIndex(filtered, index, -1));
    } else if (event.key === "Enter" && open && filtered[activeIndex]) {
      event.preventDefault(); choose(filtered[activeIndex]);
    } else if (event.key === "Escape") setOpen(false);
  }
  function blur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }

  return <FormField id={id} label={label} hint={hint} error={error}>
    <div ref={containerRef} onBlur={blur} className="relative">
      <div className="flex gap-2">
        <input id={id} role="combobox" aria-expanded={open}
          aria-controls={`${id}-listbox`} aria-autocomplete="list"
          aria-activedescendant={open && filtered[activeIndex] ? `${id}-${activeIndex}` : undefined}
          disabled={disabled} readOnly={readOnly}
          value={open ? query : selected?.label ?? ""}
          placeholder={placeholder}
          onFocus={() => { if (!readOnly) { setOpen(true); setQuery(""); setActiveIndex(-1); } }}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); setActiveIndex(-1); }}
          onKeyDown={keyDown} className={formControlClassName({ readOnly, invalid: Boolean(error) })} />
        {value && !disabled && !readOnly && <button type="button" onClick={() => onChange("")}
          aria-label={clearLabel} className="min-h-10 rounded-md border border-slate-300 px-3 text-sm">×</button>}
      </div>
      {open && !disabled && !readOnly && <ul id={`${id}-listbox`} role="listbox"
        className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-slate-300 bg-white p-1 shadow-lg">
        {filtered.length === 0 ? <li className="px-3 py-2 text-sm text-slate-500">{emptyText}</li> :
          filtered.map((option, index) => <li key={option.value} id={`${id}-${index}`}
            role="option" aria-selected={option.value === value} aria-disabled={option.disabled}
            onMouseDown={(event) => event.preventDefault()} onClick={() => choose(option)}
            className={`rounded px-3 py-2 text-sm ${option.disabled ? "cursor-not-allowed text-slate-400" :
              index === activeIndex ? "cursor-pointer bg-blue-50 text-blue-900" : "cursor-pointer hover:bg-slate-50"}`}>
            <span className="block font-medium">{option.label}</span>
            {option.description && <span className="block text-xs text-slate-500">{option.description}</span>}
          </li>)}
      </ul>}
    </div>
  </FormField>;
}

function nextEnabledIndex(options: ComboboxOption[], current: number, direction: 1 | -1) {
  if (options.length === 0) return -1;
  let index = current < 0 ? (direction === 1 ? -1 : 0) : current;
  for (let checked = 0; checked < options.length; checked++) {
    index = direction === 1
      ? (index + 1 + options.length) % options.length
      : (index - 1 + options.length) % options.length;
    if (!options[index].disabled) return index;
  }
  return -1;
}
