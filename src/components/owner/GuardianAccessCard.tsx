import React, { useEffect, useState } from 'react';
import { Link2, Plus, ShieldBan, Users, Copy, Check } from 'lucide-react';
import {
  fetchGuardianAccess, inviteGuardianAccess, revokeGuardianAccess,
} from '../../services/marketApi';
import type { GuardianAccess } from '../../domain/p1';

/**
 * Owner-side guardian access manager (spec §29). The owner invites a guardian
 * per resident and can revoke at any time. The raw invite link is shown once
 * at creation — only a hash is stored server-side.
 */
export const GuardianAccessCard: React.FC<{ residents: { id: string; name: string }[] }> = ({ residents }) => {
  const [access, setAccess] = useState<GuardianAccess[]>([]);
  const [residentId, setResidentId] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [relation, setRelation] = useState('Parent');
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    fetchGuardianAccess().then((r) => setAccess(r.access)).catch(() => setAccess([]));
  };
  useEffect(refresh, []);

  const invite = async () => {
    if (!residentId || !guardianName.trim()) {
      setError('Pick a resident and enter the guardian name.');
      return;
    }
    setBusy(true); setError(null);
    try {
      const r = await inviteGuardianAccess({ residentId, guardianName, relation });
      setInviteLink(r.inviteLink);
      setGuardianName('');
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the invite');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    try {
      await revokeGuardianAccess(id);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not revoke');
    }
  };

  const nameOf = (id: string) => residents.find((r) => r.id === id)?.name || 'Unknown resident';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-4">
      <div className="flex items-start gap-2 mb-3">
        <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
          <Users className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-black text-slate-900">Parent / Guardian access</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Guardians see rent status, the executed agreement state, deposit status and property notices — never other residents' data or movement tracking.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] gap-2 mb-3">
        <select
          value={residentId}
          onChange={(e) => setResidentId(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 bg-white"
        >
          <option value="">Select resident…</option>
          {residents.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <input
          value={guardianName}
          onChange={(e) => setGuardianName(e.target.value)}
          placeholder="Guardian name"
          className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
        />
        <input
          value={relation}
          onChange={(e) => setRelation(e.target.value)}
          placeholder="Relation"
          className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 w-24"
        />
        <button
          onClick={invite}
          disabled={busy}
          className="rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-2 text-xs font-bold flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> Invite
        </button>
      </div>
      {error && <p className="text-[11px] font-bold text-red-600 mb-2">{error}</p>}

      {inviteLink && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 mb-3">
          <p className="text-[11px] font-black text-emerald-800 mb-1 flex items-center gap-1">
            <Link2 className="w-3 h-3" /> Share this link now — it is shown only once
          </p>
          <div className="flex items-center gap-2">
            <code className="text-[10px] bg-white rounded-lg px-2 py-1.5 flex-1 truncate border border-emerald-200">{inviteLink}</code>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(inviteLink).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }).catch(() => { /* clipboard unavailable */ });
              }}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1.5 text-[10px] font-bold flex items-center gap-1"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="text-[10px] text-emerald-700 mt-1.5">Send it on WhatsApp — anyone holding the link can read that resident's view until you revoke it.</p>
        </div>
      )}

      {access.length === 0 ? (
        <p className="text-[11px] text-slate-400 text-center py-3">No guardian links yet. Invite a parent to give them read-only visibility.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {access.map((g) => (
            <li key={g.id} className="flex items-center justify-between py-2.5">
              <div>
                <p className="text-xs font-bold text-slate-900">
                  {g.guardianName}
                  {g.relation ? <span className="text-slate-400 font-semibold"> · {g.relation}</span> : null}
                </p>
                <p className="text-[10px] text-slate-500">for {nameOf(g.residentId)}</p>
              </div>
              {g.status === 'active' ? (
                <button
                  onClick={() => revoke(g.id)}
                  className="text-[10px] font-bold text-red-600 hover:text-red-800 border border-red-200 rounded-lg px-2 py-1 flex items-center gap-1"
                >
                  <ShieldBan className="w-3 h-3" /> Revoke
                </button>
              ) : (
                <span className="text-[10px] font-bold text-slate-400">Revoked</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
