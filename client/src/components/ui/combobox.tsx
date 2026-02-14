import { Check, ChevronsUpDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

interface ComboboxOption {
  label: string;
  value: string;
}

interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
}

function Combobox({ value, onChange, options, placeholder, searchPlaceholder, emptyText = 'No results.' }: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
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
      <Button
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className="w-full justify-between font-normal"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="truncate">{selectedOption ? selectedOption.label : (value || placeholder)}</span>
        <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
      </Button>
      {open && (
        <div className="absolute left-0 z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn('size-4', value === option.value ? 'opacity-100' : 'opacity-0')} />
                    <div className="min-w-0">
                      <span className="block truncate">{option.label}</span>
                      {option.label !== option.value && <span className="block truncate text-xs text-muted-foreground">{option.value}</span>}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  );
}

export { Combobox, type ComboboxOption };
