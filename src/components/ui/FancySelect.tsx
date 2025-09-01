import React, {useEffect, useMemo, useRef, useState} from 'react';

type Option = { label: string; value: string };
type Props = {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  className?: string;
  placeholder?: string;
};

export default function FancySelect({
  value,
  onChange,
  options,
  className = '',
  placeholder = 'Select…',
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = useMemo(
    () => options.find(o => o.value === value),
    [options, value]
  );

  // close on outside click / esc
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-left
                   focus:outline-none focus:ring-2 focus:ring-brand-blue flex items-center justify-between"
      >
        <span className={current ? '' : 'opacity-60'}>
          {current?.label ?? placeholder}
        </span>
        <svg width="18" height="18" viewBox="0 0 24 24" className="opacity-80">
          <path fill="currentColor" d="M7 10l5 5 5-5z" />
        </svg>
      </button>

      {/* menu */}
      {open && (
        <div
          className="absolute z-50 mt-2 w-full rounded-xl border border-white/10
                     bg-[#0f172a]/95 backdrop-blur shadow-xl overflow-hidden"
          role="listbox"
        >
          {options.map(opt => {
            const active = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm
                           hover:bg-white/10 focus:bg-white/10
                           ${active ? 'bg-brand-blue/25 text-white' : 'text-gray-200'}`}
                role="option"
                aria-selected={active}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
