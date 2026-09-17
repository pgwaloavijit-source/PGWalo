import React, { useState } from 'react';
import { LifeBuoy, Send, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const SupportCenter: React.FC = () => {
  const { currentUser, supportTickets, createSupportTicket, updateSupportTicket } = useApp();
  const [type, setType] = useState('General');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const isAdmin = currentUser?.role === 'superadmin' || currentUser?.role === 'admin';
  const visibleTickets = isAdmin ? supportTickets : supportTickets.filter((ticket) => ticket.requesterId === currentUser?.id);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !description.trim()) return;
    createSupportTicket({ type, title: title.trim(), description: description.trim(), imageUrl: imageUrl || undefined });
    setTitle('');
    setDescription('');
    setImageUrl('');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Support desk</p>
        <h1 className="text-2xl font-black text-slate-900">{isAdmin ? 'Company support queue' : 'How can we help?'}</h1>
      </div>
      {!isAdmin && (
        <form onSubmit={submit} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <div className="flex items-center gap-2 font-bold text-slate-900"><LifeBuoy className="w-5 h-5 text-indigo-600" /> Raise a query</div>
          <div className="grid sm:grid-cols-2 gap-3">
            <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <option>General</option><option>Payment</option><option>Agreement</option><option>Room allocation</option><option>Technical issue</option>
            </select>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short title" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe your issue" rows={4} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          <input type="file" accept="image/*" onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => setImageUrl(typeof reader.result === 'string' ? reader.result : '');
            reader.readAsDataURL(file);
          }} className="w-full text-xs text-slate-500" />
          <button className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white"><Send className="w-4 h-4" /> Submit ticket</button>
        </form>
      )}
      <div className="space-y-3">
        {visibleTickets.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No tickets yet.</div>}
        {visibleTickets.map((ticket) => (
          <div key={ticket.id} className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-xs font-bold text-indigo-600">{ticket.type}</p><h3 className="font-bold text-slate-900">{ticket.title}</h3><p className="text-sm text-slate-600 mt-1">{ticket.description}</p></div>
              <select value={ticket.status} disabled={!isAdmin} onChange={(e) => updateSupportTicket(ticket.id, e.target.value as 'Raised' | 'Open' | 'Resolved' | 'Closed')} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold">
                <option>Raised</option><option>Open</option><option>Resolved</option><option>Closed</option>
              </select>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500"><CheckCircle2 className="w-4 h-4" /> {ticket.requesterName} · {new Date(ticket.createdAt).toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
