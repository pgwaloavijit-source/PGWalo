import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ClipboardList, RefreshCw, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp,
  Pencil, X, Plus, Trash2, Save, RotateCcw,
} from 'lucide-react';
import {
  fetchOpsOverview, fetchOpsTemplates, saveOpsTemplate, resolveOpsIssue,
  OpsRun, OpsIssue, opsApiEnabled,
} from '../../services/staffOps';
import { CHECKLIST_TEMPLATES, itemsForRole, titleForRole } from '../../domain/staffOps';

/**
 * Owner monitoring + checklist editor. Rendered inside the EXISTING owner
 * dashboard as the "Staff Operations" tab — no redesign of anything else.
 * Owner sees staff-wise/role-wise completion, reported issues, escalations,
 * and can edit the checklist each role works from.
 */

const statusStyles: Record<string, string> = {
  'Not Started': 'bg-slate-100 text-slate-600 border-slate-200',
  'In Progress': 'bg-blue-50 text-blue-700 border-blue-200',
  'Partially Completed': 'bg-blue-50 text-blue-700 border-blue-200',
  'Requires Attention': 'bg-amber-50 text-amber-700 border-amber-200',
  Completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Blocked: 'bg-rose-50 text-rose-700 border-rose-200',
  'Requires Owner Attention': 'bg-rose-50 text-rose-700 border-rose-200',
};

interface EditorItem {
  label: string;
  section: string;
  mandatory: boolean;
}

const ChecklistEditor: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const roles = useMemo(
    () => Array.from(new Set(CHECKLIST_TEMPLATES.map((t) => t.role))),
    []
  );
  const [role, setRole] = useState(roles[0]);
  const [title, setTitle] = useState('');
  const [frequency, setFrequency] = useState('Daily');
  const [items, setItems] = useState<EditorItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const builtIn = itemsForRole(role).map((i) => ({ label: i.label, section: i.section, mandatory: i.mandatory }));
    setItems(builtIn);
    setTitle(titleForRole(role));
    setSaved(false);
  }, [role]);

  const move = (index: number, dir: -1 | 1) => {
    setItems((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    const ok = await saveOpsTemplate({
      role,
      title: title.trim() || undefined,
      frequency,
      items: items.map((i) => ({ label: i.label, section: i.section, mandatory: i.mandatory })),
    });
    setSaving(false);
    setSaved(ok);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90dvh] overflow-y-auto p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between sticky top-0 bg-white pb-2">
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <Pencil className="w-4 h-4 text-blue-600" /> Edit Checklist Template
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-1">
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold"
            >
              {roles.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold" />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Frequency</label>
            <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold">
              {['Daily', 'Weekly', 'Monthly'].map((f) => <option key={f}>{f}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={index} className="flex items-center gap-2 bg-slate-50 rounded-xl p-2 border border-slate-100">
              <input
                value={item.label}
                onChange={(e) => setItems((prev) => prev.map((p, i) => (i === index ? { ...p, label: e.target.value } : p)))}
                className="flex-1 px-2 py-1.5 rounded-lg border border-slate-200 text-[11px] font-semibold bg-white"
              />
              <input
                value={item.section}
                onChange={(e) => setItems((prev) => prev.map((p, i) => (i === index ? { ...p, section: e.target.value } : p)))}
                placeholder="Section"
                className="w-24 px-2 py-1.5 rounded-lg border border-slate-200 text-[10px] bg-white"
              />
              <label className="flex items-center gap-1 text-[10px] font-bold text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={item.mandatory}
                  onChange={(e) => setItems((prev) => prev.map((p, i) => (i === index ? { ...p, mandatory: e.target.checked } : p)))}
                />
                Must
              </label>
              <button onClick={() => move(index, -1)} className="text-[10px] font-bold text-slate-400 hover:text-blue-600 px-1">↑</button>
              <button onClick={() => move(index, 1)} className="text-[10px] font-bold text-slate-400 hover:text-blue-600 px-1">↓</button>
              <button onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))} className="text-slate-300 hover:text-rose-600">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={() => setItems((prev) => [...prev, { label: '', section: 'Checklist', mandatory: false }])}
          className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> Add item
        </button>

        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
          <button
            onClick={() => void save()}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2"
          >
            <Save className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Save template'}
          </button>
          <button
            onClick={() => {
              const builtIn = itemsForRole(role).map((i) => ({ label: i.label, section: i.section, mandatory: i.mandatory }));
              setItems(builtIn);
              setTitle(titleForRole(role));
            }}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset to default
          </button>
          {saved && <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Saved — staff get it on their next day's checklist</span>}
        </div>
      </div>
    </div>
  );
};

export const OwnerOpsTab: React.FC = () => {
  const [runs, setRuns] = useState<OpsRun[]>([]);
  const [issues, setIssues] = useState<OpsIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [openRun, setOpenRun] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    if (!opsApiEnabled()) {
      setOffline(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    const data = await fetchOpsOverview(date);
    setRuns(data.runs);
    setIssues(data.issues);
    setOffline(false);
    setLoading(false);
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(() => {
    let completed = 0, total = 0, mandatoryPending = 0, overdue = 0, blocked = 0;
    for (const run of runs) {
      for (const item of run.items) {
        total += 1;
        if (item.state === 'Done' || item.state === 'Not Applicable') completed += 1;
        else if (item.mandatory) mandatoryPending += 1;
      }
      if (run.status === 'Requires Attention' || run.status === 'Requires Owner Attention') overdue += 1;
      if (run.status === 'Blocked') blocked += 1;
    }
    return { completed, total, mandatoryPending, overdue, blocked, pct: total ? Math.round((completed / total) * 100) : 0 };
  }, [runs]);

  const byStaff = useMemo(() => {
    const map = new Map<string, OpsRun[]>();
    for (const run of runs) {
      const key = `${run.staffName} (${run.staffRoles.join(', ') || run.role})`;
      map.set(key, [...(map.get(key) || []), run]);
    }
    return Array.from(map.entries());
  }, [runs]);

  if (offline) {
    return (
      <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-10 text-center max-w-2xl mx-auto">
        <ClipboardList className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm font-bold text-slate-500">Staff operations need a live connection</p>
        <p className="text-xs text-slate-400 mt-1">Sign in with your owner account to see staff checklists and reported issues.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
              <ClipboardList className="w-3.5 h-3.5" /> Operational Management
            </div>
            <h2 className="text-xl font-black text-slate-900">Staff Operations</h2>
            <p className="text-xs text-slate-500 mt-1">Role checklists, task completion and escalations — live from your staff.</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold"
            />
            <button onClick={() => void load()} className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:text-blue-600" title="Refresh">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowEditor(true)}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5"
            >
              <Pencil className="w-3.5 h-3.5" /> Edit Checklists
            </button>
          </div>
        </div>

        {/* Summary tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-slate-100">
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-[10px] font-black uppercase text-slate-400">Overall completion</p>
            <p className="text-lg font-black text-slate-900">{totals.pct}%</p>
            <p className="text-[10px] text-slate-500 font-bold">{totals.completed}/{totals.total} items</p>
          </div>
          <div className="rounded-2xl bg-amber-50 p-3">
            <p className="text-[10px] font-black uppercase text-amber-500">Mandatory pending</p>
            <p className="text-lg font-black text-amber-700">{totals.mandatoryPending}</p>
          </div>
          <div className="rounded-2xl bg-rose-50 p-3">
            <p className="text-[10px] font-black uppercase text-rose-400">Requires attention</p>
            <p className="text-lg font-black text-rose-700">{totals.overdue}</p>
          </div>
          <div className="rounded-2xl bg-blue-50 p-3">
            <p className="text-[10px] font-black uppercase text-blue-400">Open issues</p>
            <p className="text-lg font-black text-blue-700">{issues.filter((i) => i.status === 'Open').length}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center">
          <RefreshCw className="w-6 h-6 text-blue-500 animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500 mt-3">Loading operations…</p>
        </div>
      ) : (
        <>
          {/* Staff-wise checklists */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Staff-wise completion</h3>
            {byStaff.length === 0 ? (
              <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-10 text-center">
                <ClipboardList className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-500">No checklists started on this date</p>
                <p className="text-xs text-slate-400 mt-1">Staff checklists appear here as soon as your team opens their dashboard.</p>
              </div>
            ) : (
              byStaff.map(([staffKey, staffRuns]) => (
                <div key={staffKey} className="bg-white rounded-3xl border border-slate-200 p-5 shadow-2xs">
                  <p className="text-sm font-extrabold text-slate-900 mb-3">{staffKey}</p>
                  <div className="space-y-2">
                    {staffRuns.map((run) => {
                      const done = run.items.filter((i) => i.state === 'Done' || i.state === 'Not Applicable').length;
                      const mPending = run.items.filter((i) => i.mandatory && i.state !== 'Done' && i.state !== 'Not Applicable').length;
                      const open = openRun === run.id;
                      return (
                        <div key={run.id} className="rounded-2xl border border-slate-100 overflow-hidden">
                          <button
                            onClick={() => setOpenRun(open ? null : run.id)}
                            className="w-full flex items-center justify-between gap-2 p-3 hover:bg-slate-50 text-left"
                            aria-expanded={open}
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 truncate">{run.templateTitle}</p>
                              <p className="text-[10px] text-slate-500">{run.role} · {done}/{run.items.length} done · updated {run.updatedAt ? new Date(run.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {mPending > 0 && (
                                <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">{mPending} must-do pending</span>
                              )}
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusStyles[run.status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                {run.status}
                              </span>
                            </div>
                          </button>
                          {open && (
                            <div className="border-t border-slate-100 p-3 bg-slate-50/50 space-y-1">
                              {run.items.map((item) => (
                                <div key={item.id} className="flex items-center justify-between gap-2 text-[11px]">
                                  <span className={item.state === 'Done' ? 'text-slate-400 line-through' : 'text-slate-700 font-semibold'}>
                                    {item.label}
                                    {item.mandatory && <span className="ml-1 text-[8px] font-black text-amber-600 align-top">MUST</span>}
                                  </span>
                                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                                    item.state === 'Done' ? 'bg-emerald-100 text-emerald-700'
                                    : item.state === 'Not Done' ? 'bg-rose-100 text-rose-700'
                                    : item.state === 'Not Applicable' ? 'bg-slate-200 text-slate-500'
                                    : 'bg-slate-100 text-slate-400'
                                  }`}>
                                    {item.state || 'PENDING'}
                                  </span>
                                </div>
                              ))}
                              {run.note && (
                                <p className="text-[11px] italic text-slate-500 bg-white rounded-lg p-2 border border-slate-100 mt-2">
                                  <span className="font-bold not-italic">Note:</span> {run.note}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Reported issues / escalations */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Reported issues & escalations</h3>
            {issues.length === 0 ? (
              <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-8 text-center">
                <CheckCircle2 className="w-7 h-7 text-emerald-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-500">No issues reported — operations are smooth</p>
              </div>
            ) : (
              <div className="space-y-2">
                {issues.map((issue) => (
                  <div
                    key={issue.id}
                    className={`bg-white rounded-2xl border p-4 flex items-start justify-between gap-3 ${
                      issue.status === 'Open' ? 'border-amber-200' : 'border-slate-200 opacity-70'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {issue.status === 'Open' && <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
                        <p className="text-xs font-bold text-slate-900">{issue.itemLabel || 'General issue'}</p>
                        <span className="text-[10px] font-bold text-slate-400">{issue.staffName}{issue.role ? ` · ${issue.role}` : ''}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1">{issue.note}</p>
                      {issue.createdAt && <p className="text-[10px] text-slate-400 mt-1">{new Date(issue.createdAt).toLocaleString()}</p>}
                    </div>
                    {issue.status === 'Open' ? (
                      <button
                        onClick={async () => {
                          if (await resolveOpsIssue(issue.id, 'Resolved')) void load();
                        }}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold shrink-0"
                      >
                        Mark Resolved
                      </button>
                    ) : (
                      <span className="text-[10px] font-bold text-emerald-600 shrink-0">{issue.status}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {showEditor && <ChecklistEditor onClose={() => { setShowEditor(false); void load(); }} />}
    </div>
  );
};
