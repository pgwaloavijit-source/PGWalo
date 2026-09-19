import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useOwnerScope } from '../../utils/ownership';
import { previewImport, commitImport, downloadCsvTemplate, downloadRejectionReport } from '../../services/marketApi';
import type { ImportKind, ImportPreview } from '../../domain/market';
import { parseCsv, buildImportPreview } from '../../domain/csvImport';
import { AlertTriangle, Download, FileSpreadsheet, Upload, X } from 'lucide-react';

const KINDS: { key: ImportKind; label: string }[] = [
  { key: 'beds', label: 'Rooms & beds' },
  { key: 'residents', label: 'Active residents' },
  { key: 'dues', label: 'Opening dues' },
  { key: 'deposits', label: 'Opening deposits' },
  { key: 'leads', label: 'Leads' },
];

export const ImportModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { addResident } = useApp();
  const { properties, residents, beds } = useOwnerScope();
  const [kind, setKind] = useState<ImportKind>('residents');
  const [propertyId, setPropertyId] = useState(properties[0]?.id || '');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [fileName, setFileName] = useState('');
  const [committing, setCommitting] = useState(false);
  const [result, setResult] = useState<{ committed: number; rejected: number } | null>(null);
  const [error, setError] = useState('');

  const existingPhones = useMemo(() => residents.map((r) => r.phone), [residents]);
  const existingBedKeys = useMemo(
    () => beds.map((b) => `${b.propertyId}|${b.roomNumber}`.toLowerCase()),
    [beds]
  );

  const handleFile = async (file: File) => {
    setError('');
    setResult(null);
    setFileName(file.name);
    try {
      const p = await previewImport(kind, file, { existingPhones, existingBedKeys });
      setPreview(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not parse the file');
    }
  };

  const handleCommit = async () => {
    if (!preview) return;
    setCommitting(true);
    setError('');
    try {
      const validRows = preview.mappedRows.filter(
        (_, idx) => !preview.errors.some((e) => e.row === idx + 2)
      );
      if (isProductionApi()) {
        const r = await commitImport(kind, propertyId, validRows);
        setResult({ committed: r.committed, rejected: r.rejected });
      } else {
        // Demo mode: apply through AppContext so the UI updates live.
        let committed = 0;
        if (kind === 'residents') {
          for (const row of validRows) {
            if (!row.name || !row.phone) continue;
            addResident({
              name: row.name,
              email: row.email || `${row.phone}@imported.local`,
              phone: row.phone,
              avatar: '',
              propertyId,
              propertyName: properties.find((p) => p.id === propertyId)?.name || '',
              roomNumber: row.room || '',
              roomType: (row.sharing as never) || 'Single',
              bedNumber: row.bed || '',
              monthlyRent: Number(row.rent || 0),
              depositAmount: Number(row.deposit || 0),
              moveInDate: row.moveIn || new Date().toISOString().slice(0, 10),
              rentStatus: 'Pending',
              rentDueDate: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10),
              emergencyContact: row.phone,
              kycVerified: false,
              status: 'Active',
            } as never);
            committed += 1;
          }
        } else {
          committed = validRows.length; // other kinds land via the production commit path
        }
        setResult({ committed, rejected: preview.errorCount });
      }
      setPreview(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[88vh] overflow-y-auto p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900">Import from spreadsheet</h2>
            <p className="text-xs text-slate-500 mt-0.5">Upload a CSV — preview, fix row errors, then commit. Nothing is written until you approve.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[10px] font-black uppercase text-slate-400">What are you importing?</span>
            <select
              value={kind}
              onChange={(e) => { setKind(e.target.value as ImportKind); setPreview(null); }}
              className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 text-sm"
            >
              {KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] font-black uppercase text-slate-400">Into property</span>
            <select
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-300 text-sm"
            >
              {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => downloadCsvTemplate(kind)}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> Download {kind} template
          </button>
          <label className="px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer">
            <Upload className="w-3.5 h-3.5" /> {fileName ? 'Change file' : 'Upload CSV'}
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </label>
          {fileName && <span className="text-xs text-slate-500 self-center">{fileName}</span>}
        </div>

        {error && <p className="text-xs font-bold text-red-600">{error}</p>}

        {result && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <strong>{result.committed}</strong> row{result.committed === 1 ? '' : 's'} imported.
            {result.rejected > 0 && <> <strong>{result.rejected}</strong> rejected — download the rejection report below to fix them.</>}
          </div>
        )}

        {preview && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5">
                <div className="text-[10px] font-black uppercase text-emerald-600">Ready</div>
                <div className="text-lg font-black text-emerald-900">{preview.validCount}</div>
              </div>
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5">
                <div className="text-[10px] font-black uppercase text-red-500">Errors</div>
                <div className="text-lg font-black text-red-900">{preview.errorCount}</div>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5">
                <div className="text-[10px] font-black uppercase text-amber-600">Duplicates</div>
                <div className="text-lg font-black text-amber-900">{preview.duplicates}</div>
              </div>
            </div>

            {preview.errors.length > 0 && (
              <div className="rounded-2xl border border-red-100 bg-red-50/60 p-3 max-h-36 overflow-y-auto">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-red-800 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Row errors</p>
                  <button onClick={() => downloadRejectionReport(preview)} className="text-[11px] font-bold text-red-700 underline">Download report</button>
                </div>
                <ul className="mt-1.5 space-y-0.5">
                  {preview.errors.slice(0, 12).map((e, i) => (
                    <li key={i} className="text-[11px] text-red-700">Row {e.row}: {e.field && <strong>{e.field}</strong>} — {e.message}</li>
                  ))}
                  {preview.errors.length > 12 && <li className="text-[11px] text-red-500">…and {preview.errors.length - 12} more</li>}
                </ul>
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-2 bg-slate-50 text-[10px] font-black uppercase text-slate-400">Preview (first 8 rows)</div>
              <div className="overflow-x-auto max-h-56">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white">
                    <tr className="text-left text-[10px] font-black uppercase text-slate-400 border-b border-slate-100">
                      <th className="px-3 py-1.5">#</th>
                      {['name', 'phone', 'room', 'bed', 'rent', 'deposit', 'moveIn'].map((h) => (
                        <th key={h} className="px-3 py-1.5">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {preview.mappedRows.slice(0, 8).map((row, idx) => {
                      const hasError = preview.errors.some((e) => e.row === idx + 2);
                      return (
                        <tr key={idx} className={hasError ? 'bg-red-50/60' : ''}>
                          <td className="px-3 py-1.5 text-slate-400">{idx + 2}</td>
                          {['name', 'phone', 'room', 'bed', 'rent', 'deposit', 'moveIn'].map((h) => (
                            <td key={h} className="px-3 py-1.5 text-slate-700">{row[h] || '—'}</td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <button
              onClick={handleCommit}
              disabled={committing || preview.validCount === 0}
              className="w-full px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-black disabled:opacity-50"
            >
              {committing ? 'Importing…' : `Import ${preview.validCount} valid row${preview.validCount === 1 ? '' : 's'}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const isProductionApi = (): boolean => {
  const configured = Boolean((import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, ''));
  return import.meta.env.PROD || configured;
};

void parseCsv;
void buildImportPreview;
void FileSpreadsheet;
