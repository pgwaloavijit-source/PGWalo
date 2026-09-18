import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2, AlertTriangle, MessageSquarePlus,
  RefreshCw, ClipboardList, ChevronDown, ChevronUp, Camera, X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  fetchMyRuns, updateChecklistItem, reportOpsIssue, opsApiEnabled,
  OpsRun, OpsRunItem, OpsIssue,
} from '../../services/staffOps';
import { itemsForRole, titleForRole, rolesOf } from '../../domain/staffOps';
import { uploadComplaintPhoto } from '../../services/media';

/**
 * "What work do I have to complete today?" — one combined view across every
 * role the staff member holds. Each role renders its own live checklist run
 * (persisted server-side), with Done / Not Done / Not Applicable, comments,
 * photos and issue reporting. Falls back to the built-in role template when
 * the backend is unreachable (demo mode), clearly labelled as offline.
 */

const stateStyles: Record<string, string> = {
  Done: 'bg-emerald-600 border-emerald-600 text-white',
  'Not Done': 'bg-rose-600 border-rose-600 text-white',
  'Not Applicable': 'bg-slate-400 border-slate-400 text-white',
};

function statusBadge(status: string) {
  const map: Record<string, string> = {
    'Not Started': 'bg-slate-100 text-slate-600 border-slate-200',
    'In Progress': 'bg-blue-50 text-blue-700 border-blue-200',
    'Partially Completed': 'bg-blue-50 text-blue-700 border-blue-200',
    'Requires Attention': 'bg-amber-50 text-amber-700 border-amber-200',
    Completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Blocked: 'bg-rose-50 text-rose-700 border-rose-200',
    'Requires Owner Attention': 'bg-rose-50 text-rose-700 border-rose-200',
    Overdue: 'bg-rose-600 text-white border-rose-600',
  };
  return map[status] || 'bg-slate-100 text-slate-600 border-slate-200';
}

export const TodayWorkPanel: React.FC<{ refreshKey?: number }> = ({ refreshKey = 0 }) => {
  const { currentUser, currentStaff, logAuditEvent } = useApp();
  const [runs, setRuns] = useState<OpsRun[]>([]);
  const [issues, setIssues] = useState<OpsIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [openRun, setOpenRun] = useState<string | null>(null);
  const [issueFor, setIssueFor] = useState<{ runId: string; itemId?: string; label: string } | null>(null);
  const [issueText, setIssueText] = useState('');
  const [commentFor, setCommentFor] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [flash, setFlash] = useState('');

  const staffRoles = useMemo(
    () => (currentStaff ? rolesOf({ role: currentStaff.role, roles: currentStaff.roles }) : []),
    [currentStaff?.id, currentStaff?.role, (currentStaff as { roles?: string[] } | undefined)?.roles?.join(',')]
  );

  const load = useCallback(async () => {
    if (!opsApiEnabled() || staffRoles.length === 0) {
      setOffline(!opsApiEnabled() && staffRoles.length > 0);
      setRuns([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const data = await fetchMyRuns();
    setRuns(data.runs);
    setIssues(data.issues);
    setOffline(false);
    setLoading(false);
    // Default open the first incomplete run.
    if (data.runs.length > 0) {
      setOpenRun((prev) => prev || data.runs.find((r) => r.status !== 'Completed')?.id || data.runs[0].id);
    }
  }, [staffRoles.join(',')]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  // Auto-refresh every 90s so owner assignments show up without reloads.
  useEffect(() => {
    const timer = window.setInterval(() => void load(), 90_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const persist = useCallback(
    async (run: OpsRun, item: OpsRunItem | undefined, patch: { state?: OpsRunItem['state']; comment?: string; note?: string }) => {
      if (!item && patch.note === undefined) return;
      const key = `${run.id}:${item?.id || 'note'}`;
      setSaving(key);
      // Optimistic update.
      setRuns((prev) =>
        prev.map((r) =>
          r.id !== run.id
            ? r
            : {
                ...r,
                items: item
                  ? r.items.map((i) =>
                      i.id === item.id
                        ? { ...i, ...patch, updatedAt: new Date().toISOString() }
                        : i
                    )
                  : r.items,
                note: patch.note !== undefined ? patch.note : r.note,
              }
        )
      );
      const result = await updateChecklistItem({
        runId: run.id,
        itemId: item?.id,
        state: patch.state || undefined,
        comment: patch.comment,
        note: patch.note,
      });
      setSaving(null);
      if (result.ok && result.items) {
        setRuns((prev) => prev.map((r) => (r.id === run.id ? { ...r, items: result.items!, status: result.status || r.status } : r)));
        logAuditEvent(
          'Checklist Item Updated',
          `${run.templateTitle} (${run.role})`,
          item ? `${item.label} → ${patch.state || 'comment added'}` : 'note updated'
        );
      }
    },
    [logAuditEvent]
  );

  const submitIssue = async () => {
    if (!issueFor || !issueText.trim()) return;
    const ok = await reportOpsIssue({ runId: issueFor.runId, itemId: issueFor.itemId, note: issueText.trim() });
    setFlash(ok ? 'Issue reported — the owner has been notified.' : 'Could not report the issue right now.');
    setTimeout(() => setFlash(''), 4000);
    setIssueFor(null);
    setIssueText('');
    if (ok) void load();
  };

  const uploadItemPhoto = async (run: OpsRun, item: OpsRunItem, file: File) => {
    setSaving(`${run.id}:${item.id}`);
    try {
      const result = await uploadComplaintPhoto(file);
      const url = result?.url || result?.dataUrl;
      if (url) {
        setRuns((prev) =>
          prev.map((r) =>
            r.id !== run.id
              ? r
              : { ...r, items: r.items.map((i) => (i.id === item.id ? { ...i, photoUrl: url } : i)) }
          )
        );
        await persist(run, item, { comment: item.comment || 'Photo attached' });
        setFlash('Photo attached.');
      } else {
        setFlash('Photo upload failed.');
      }
    } catch {
      setFlash('Photo upload failed.');
    }
    setSaving(null);
    setTimeout(() => setFlash(''), 4000);
  };

  const runProgress = (run: OpsRun) => {
    const done = run.items.filter((i) => i.state === 'Done').length;
    const na = run.items.filter((i) => i.state === 'Not Applicable').length;
    const mandatoryPending = run.items.filter((i) => i.mandatory && i.state !== 'Done' && i.state !== 'Not Applicable').length;
    const completed = done + na;
    return { done, na, completed, mandatoryPending, total: run.items.length };
  };

  const overall = useMemo(() => {
    const totals = runs.reduce(
      (acc, r) => {
        const p = runProgress(r);
        acc.completed += p.completed;
        acc.total += p.total;
        acc.mandatoryPending += p.mandatoryPending;
        if (r.status === 'Completed') acc.runsDone += 1;
        return acc;
      },
      { completed: 0, total: 0, mandatoryPending: 0, runsDone: 0 }
    );
    return {
      ...totals,
      pct: totals.total > 0 ? Math.round((totals.completed / totals.total) * 100) : 0,
    };
  }, [runs]);

  if (!currentUser) return null;

  // Offline/demo fallback: show the built-in role checklists, clearly labelled.
  if (offline || (!loading && runs.length === 0 && staffRoles.length > 0 && !opsApiEnabled())) {
    return (
      <div className="space-y-4">
        {staffRoles.map((role) => {
          const items = itemsForRole(role);
          if (items.length === 0) return null;
          return (
            <div key={role} className="bg-white rounded-3xl border border-slate-200 p-5 shadow-2xs">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">{titleForRole(role)}</h3>
                  <p className="text-[11px] text-slate-500">{role}</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-100 text-slate-500">Offline preview</span>
              </div>
              <div className="space-y-1.5">
                {items.slice(0, 8).map((i) => (
                  <div key={i.id} className="flex items-center gap-2 text-xs text-slate-600">
                    <ClipboardList className="w-3.5 h-3.5 text-slate-300" /> {i.label}
                    {i.mandatory && <span className="text-[9px] font-bold text-amber-600">MANDATORY</span>}
                  </div>
                ))}
                {items.length > 8 && <p className="text-[11px] text-slate-400">+{items.length - 8} more items</p>}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Overall progress */}
      {runs.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-extrabold text-slate-900">Today's Progress</h3>
            <button onClick={() => void load()} className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${overall.mandatoryPending > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                style={{ width: `${overall.pct}%` }}
              />
            </div>
            <span className="text-xs font-black text-slate-900 whitespace-nowrap">
              {overall.completed}/{overall.total}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-2 flex-wrap text-[11px]">
            <span className="font-bold text-slate-500">
              {overall.runsDone}/{runs.length} checklists completed
            </span>
            {overall.mandatoryPending > 0 && (
              <span className="font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                {overall.mandatoryPending} mandatory pending
              </span>
            )}
            {issues.filter((i) => i.status === 'Open').length > 0 && (
              <span className="font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                {issues.filter((i) => i.status === 'Open').length} open issues
              </span>
            )}
          </div>
        </div>
      )}

      {flash && (
        <div role="status" className="bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-2xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" /> {flash}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center">
          <RefreshCw className="w-6 h-6 text-blue-500 animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500 mt-3">Loading today's work…</p>
        </div>
      ) : runs.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-10 text-center">
          <ClipboardList className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-500">No checklists assigned</p>
          <p className="text-xs text-slate-400 mt-1">
            Ask the owner to assign you a role — your daily checklist will appear here automatically.
          </p>
        </div>
      ) : (
        runs.map((run) => {
          const p = runProgress(run);
          const open = openRun === run.id;
          const sections = Array.from(new Set(run.items.map((i) => i.section)));
          return (
            <div key={run.id} className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
              {/* Run header — always visible */}
              <button
                onClick={() => setOpenRun(open ? null : run.id)}
                className="w-full text-left p-5 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition"
                aria-expanded={open}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-extrabold text-slate-900 truncate">{run.templateTitle}</h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusBadge(run.status)}`}>
                      {run.status}
                    </span>
                    {p.mandatoryPending > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        {p.mandatoryPending} mandatory pending
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {run.role} · {p.completed}/{p.total} done · {run.frequency}
                  </p>
                  {/* mini progress bar */}
                  <div className="h-1.5 rounded-full bg-slate-100 mt-2 max-w-[220px] overflow-hidden">
                    <div
                      className={`h-full rounded-full ${p.mandatoryPending > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${p.total ? Math.round((p.completed / p.total) * 100) : 0}%` }}
                    />
                  </div>
                </div>
                {open ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
              </button>

              {open && (
                <div className="px-5 pb-5 space-y-4 border-t border-slate-100 pt-4">
                  {sections.map((section) => (
                    <div key={section}>
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">{section}</p>
                      <div className="space-y-2">
                        {run.items.filter((i) => i.section === section).map((item) => {
                          const key = `${run.id}:${item.id}`;
                          return (
                            <div
                              key={item.id}
                              className={`rounded-2xl border p-3 transition ${
                                item.state === 'Done'
                                  ? 'bg-emerald-50/50 border-emerald-200'
                                  : item.state === 'Not Done'
                                  ? 'bg-rose-50/50 border-rose-200'
                                  : 'bg-white border-slate-200'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className={`text-xs font-bold ${item.state === 'Done' ? 'text-slate-500' : 'text-slate-800'}`}>
                                    {item.label}
                                    {item.mandatory && <span className="ml-1.5 text-[9px] font-black text-amber-600 align-top">MANDATORY</span>}
                                  </p>
                                  {item.comment && <p className="text-[11px] text-slate-500 mt-0.5 italic">"{item.comment}"</p>}
                                  {item.photoUrl && (
                                    <img src={item.photoUrl} alt="Attachment" className="h-16 rounded-lg border border-slate-200 mt-1.5 object-cover" />
                                  )}
                                </div>
                                {/* State toggles */}
                                <div className="flex items-center gap-1 shrink-0">
                                  {(['Done', 'Not Done', 'Not Applicable'] as const).map((state) => (
                                    <button
                                      key={state}
                                      disabled={saving === key}
                                      onClick={() => void persist(run, item, { state: item.state === state ? '' : state })}
                                      title={state}
                                      className={`w-7 h-7 rounded-lg border text-[9px] font-black flex items-center justify-center transition disabled:opacity-50 ${
                                        item.state === state
                                          ? stateStyles[state]
                                          : 'border-slate-200 text-slate-400 hover:border-slate-300 hover:bg-slate-50'
                                      }`}
                                    >
                                      {state === 'Done' ? '✓' : state === 'Not Done' ? '✕' : '—'}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              {/* Comment / photo / issue row */}
                              <div className="flex items-center gap-3 mt-2 pt-2 border-t border-slate-100">
                                <button
                                  onClick={() => {
                                    setCommentFor(commentFor === key ? null : key);
                                    setCommentText(item.comment || '');
                                  }}
                                  className="text-[10px] font-bold text-slate-500 hover:text-blue-600 flex items-center gap-1"
                                >
                                  <MessageSquarePlus className="w-3 h-3" /> {item.comment ? 'Edit note' : 'Add note'}
                                </button>
                                <label className="text-[10px] font-bold text-slate-500 hover:text-blue-600 flex items-center gap-1 cursor-pointer">
                                  <Camera className="w-3 h-3" /> Photo
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) void uploadItemPhoto(run, item, file);
                                      e.target.value = '';
                                    }}
                                  />
                                </label>
                                <button
                                  onClick={() => {
                                    setIssueFor({ runId: run.id, itemId: item.id, label: item.label });
                                    setIssueText('');
                                  }}
                                  className="text-[10px] font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1 ml-auto"
                                >
                                  <AlertTriangle className="w-3 h-3" /> Report issue
                                </button>
                              </div>
                              {commentFor === key && (
                                <div className="mt-2 flex items-center gap-2">
                                  <input
                                    value={commentText}
                                    onChange={(e) => setCommentText(e.target.value)}
                                    placeholder="Add a comment (e.g. 'Motor not working')"
                                    className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 text-[11px] focus:ring-2 focus:ring-blue-500 outline-hidden"
                                  />
                                  <button
                                    onClick={() => {
                                      void persist(run, item, { comment: commentText });
                                      setCommentFor(null);
                                    }}
                                    className="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-[11px] font-bold"
                                  >
                                    Save
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {/* Run-level note + issue */}
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Shift note / handover</label>
                    <textarea
                      defaultValue={run.note || ''}
                      onBlur={(e) => {
                        if (e.target.value !== (run.note || '')) void persist(run, undefined, { note: e.target.value });
                      }}
                      rows={2}
                      placeholder="Anything the owner or next shift should know…"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-[11px] focus:ring-2 focus:ring-blue-500 outline-hidden"
                    />
                    <button
                      onClick={() => {
                        setIssueFor({ runId: run.id, label: `${run.templateTitle} (general)` });
                        setIssueText('');
                      }}
                      className="text-[10px] font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1"
                    >
                      <AlertTriangle className="w-3 h-3" /> Report a general issue
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Issue modal */}
      {issueFor && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={() => setIssueFor(null)}>
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900">Report an issue</h3>
              <button onClick={() => setIssueFor(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-slate-500 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 font-bold text-amber-800">
              {issueFor.label}
            </p>
            <textarea
              value={issueText}
              onChange={(e) => setIssueText(e.target.value)}
              rows={3}
              autoFocus
              placeholder="Describe the problem (e.g. 'Water motor not working since morning')"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 outline-hidden"
            />
            <button
              onClick={() => void submitIssue()}
              disabled={!issueText.trim()}
              className="w-full px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white text-xs font-bold"
            >
              Report to Owner
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
