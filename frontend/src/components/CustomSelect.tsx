import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  id: string;
  label: string;
}

interface Props {
  options: SelectOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  className?: string;
}

export default function CustomSelect({ options, value, onChange, placeholder = 'Select…', className }: Props) {
  const [open, setOpen] = useState(false);
  const [pos,  setPos]  = useState<{ top: number; left: number; width: number } | null>(null);
  const btnRef          = useRef<HTMLButtonElement>(null);

  const selected = options.find(o => o.id === value);

  function toggle() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    setOpen(v => !v);
  }

  // Close on outside mousedown
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className={`flex items-center justify-between gap-2 text-left ${className ?? ''}`}
      >
        <span className={selected ? '' : 'opacity-50'}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown size={14} className="shrink-0 opacity-60" />
      </button>

      {open && pos && createPortal(
        <div
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
          className="bg-white border border-gray-200 rounded-lg shadow-xl py-1 max-h-60 overflow-y-auto"
          onMouseDown={e => e.stopPropagation()}
        >
          {options.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-400 italic">No staff found</div>
          )}
          {options.map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => { onChange(opt.id); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                opt.id === value
                  ? 'bg-gray-100 text-gray-900 font-medium'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
