import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { lookupIndianPincode } from '../../utils/indiaLocations';

interface PincodeInputProps {
  label?: string;
  value: string;
  onPincodeChange: (pincode: string) => void;
  /** Receives whatever the lookup resolved, e.g. { city, state, country }. */
  onResolved?: (location: { city: string; state: string; country: string }) => void;
  required?: boolean;
  error?: string;
  className?: string;
  placeholder?: string;
}

const digitize = (v: string) => v.replace(/\D/g, '').slice(0, 6);

/**
 * India-Post-backed pincode field. On a complete 6-digit pin it resolves
 * city/state/country and hands them to the form via `onResolved`, with a
 * status line under the input. Debounced and cancel-safe.
 */
export const PincodeInput: React.FC<PincodeInputProps> = ({
  label = 'Pincode',
  value,
  onPincodeChange,
  onResolved,
  required,
  error,
  className = '',
  placeholder = '6-digit pincode',
}) => {
  const [status, setStatus] = useState('');
  const [checking, setChecking] = useState(false);
  const runId = useRef(0);

  useEffect(() => {
    const pin = digitize(value);
    if (pin !== value) onPincodeChange(pin);
    if (pin.length !== 6) {
      setStatus('');
      setChecking(false);
      return;
    }

    const id = ++runId.current;
    let cancelled = false;
    setChecking(true);
    setStatus('Checking pincode…');

    const timer = setTimeout(() => {
      lookupIndianPincode(pin)
        .then((location) => {
          if (cancelled || id !== runId.current) return;
          setChecking(false);
          if (!location) {
            setStatus('Pincode not found — fill city/state manually.');
            return;
          }
          onResolved?.({ city: location.city, state: location.state, country: location.country });
          setStatus(`${location.city}, ${location.state}, ${location.country}`);
        })
        .catch(() => {
          if (cancelled) return;
          setChecking(false);
          setStatus('Lookup unavailable — fill city/state manually.');
        });
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <div className="relative">
        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => onPincodeChange(digitize(e.target.value))}
          placeholder={placeholder}
          maxLength={6}
          className={`w-full pl-12 pr-10 py-3 rounded-xl border ${
            error ? 'border-red-300 bg-red-50' : 'border-slate-300 bg-slate-50'
          } focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none`}
        />
        {checking && (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 animate-spin" />
        )}
      </div>
      {status && !error && <p className="mt-1 text-xs font-semibold text-blue-700">{status}</p>}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
};
