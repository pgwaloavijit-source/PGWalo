import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';

interface ComboFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  required?: boolean;
  hint?: string;
}

export const ComboField: React.FC<ComboFieldProps> = ({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select or type',
  required,
  hint,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => opt.toLowerCase().includes(q));
  }, [options, query]);

  const exact = options.some((opt) => opt.toLowerCase() === query.trim().toLowerCase());

  const pick = (next: string) => {
    onChange(next);
    setQuery(next);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </label>
      <div className="relative">
        <input
          value={query}
          required={required}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && query.trim()) {
              e.preventDefault();
              pick(query.trim());
            }
          }}
          className="w-full px-4 py-3 pr-10 rounded-2xl border border-slate-200 bg-white text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
        />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400"
          aria-label="Show suggestions"
        >
          <ChevronDown className={`w-4 h-4 transition ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
      {open && (
        <div className="absolute z-30 mt-1.5 w-full max-h-52 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
          {filtered.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => pick(opt)}
              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 ${
                opt === value ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700'
              }`}
            >
              {opt}
            </button>
          ))}
          {query.trim() && !exact && (
            <button
              type="button"
              onClick={() => pick(query.trim())}
              className="w-full text-left px-4 py-2.5 text-sm text-blue-700 hover:bg-blue-50 flex items-center gap-2 border-t border-slate-100"
            >
              <Plus className="w-3.5 h-3.5" />
              Use “{query.trim()}”
            </button>
          )}
          {!filtered.length && !query.trim() && (
            <p className="px-4 py-3 text-xs text-slate-400">Start typing to search</p>
          )}
        </div>
      )}
    </div>
  );
};
