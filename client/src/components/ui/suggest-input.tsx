import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface SuggestOption {
  value: string;
  label: string;
}

type Suggestion = string | SuggestOption;

function getLabel(s: Suggestion): string {
  return typeof s === 'string' ? s : s.label;
}

function getValue(s: Suggestion): string {
  return typeof s === 'string' ? s : s.value;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  suggestions: Suggestion[];
  placeholder?: string;
  type?: string;
  className?: string;
  loading?: boolean;
}

export function SuggestInput({ value, onChange, suggestions, placeholder, type, className, loading }: Props) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Resolve current value to its display label (if it matches a suggestion value)
  const activeOption = suggestions.find((s) => getValue(s) === value);
  const displayValue = activeOption ? getLabel(activeOption) : value;

  const filtered = suggestions.filter((s) => {
    if (!value) {
      return true;
    }
    const search = displayValue.toLowerCase();
    return getLabel(s).toLowerCase().includes(search);
  });
  const showDropdown = open && focused && filtered.length > 0;

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointerDown(e: PointerEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type={type}
        value={displayValue}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setFocused(true);
          setOpen(true);
        }}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        className={cn(
          'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
      />
      {loading && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground animate-pulse">...</span>
      )}
      {showDropdown && (
        <div className="absolute left-0 z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
          {filtered.map((s) => (
            <button
              key={getValue(s)}
              type="button"
              className={cn(
                'w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer',
                getValue(s) === value && 'bg-accent text-accent-foreground',
              )}
              onPointerDown={(e) => {
                e.preventDefault();
                onChange(getValue(s));
                setOpen(false);
              }}
            >
              {getLabel(s)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
