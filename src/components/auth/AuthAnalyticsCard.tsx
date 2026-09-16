import React, { useEffect, useState } from 'react';
import { getAuthToken, isProductionApiEnabled } from '../../services/productionApi';
import { Activity, Users, LogIn, UserPlus, XCircle } from 'lucide-react';

interface Analytics {
  funnel: { event_type: string; count: number }[];
  paths: { auth_path: string; intent: string; count: number }[];
  recent: { event_type: string; auth_path: string; intent: string; source_page: string; created_at: string }[];
}

export const AuthAnalyticsCard: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => {
    if (!isProductionApiEnabled()) return;
    const token = getAuthToken();
    if (!token) return;
    fetch('/api/auth/analytics', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : null)
      .then(setData)
      .catch(() => undefined);
  }, []);

  if (!data) {
    return (
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-500">
        Auth analytics load when signed in via production API.
      </div>
    );
  }

  const count = (type: string) => data.funnel.find((f) => f.event_type === type)?.count ?? 0;
  const metrics = [
    { label: 'Modal opens', value: count('modal_opened'), icon: Activity, color: 'text-blue-600' },
    { label: 'Sign-ins', value: count('login_success'), icon: LogIn, color: 'text-emerald-600' },
    { label: 'Sign-ups', value: count('register_success'), icon: UserPlus, color: 'text-violet-600' },
    { label: 'Failed logins', value: count('login_failed'), icon: XCircle, color: 'text-rose-500' },
    { label: 'Guests', value: count('guest_continue'), icon: Users, color: 'text-slate-600' },
  ];

  return (
    <div className="space-y-4">
      <div className={`grid ${compact ? 'grid-cols-2' : 'grid-cols-3 md:grid-cols-5'} gap-3`}>
        {metrics.map((m) => (
          <div key={m.label} className="p-3 rounded-2xl bg-white border border-slate-100 shadow-xs">
            <m.icon className={`w-4 h-4 ${m.color} mb-1`} />
            <p className="text-lg font-black text-slate-900">{m.value}</p>
            <p className="text-[10px] text-slate-500 font-medium">{m.label}</p>
          </div>
        ))}
      </div>
      {!compact && data.paths.length > 0 && (
        <div className="rounded-2xl border border-slate-100 overflow-hidden">
          <div className="px-4 py-2 bg-slate-50 text-xs font-bold text-slate-600">Top signup paths</div>
          {data.paths.slice(0, 5).map((p, i) => (
            <div key={i} className="px-4 py-2 flex justify-between text-xs border-t border-slate-50">
              <span className="font-medium capitalize">{p.auth_path} · {p.intent || 'general'}</span>
              <span className="text-slate-500">{p.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
