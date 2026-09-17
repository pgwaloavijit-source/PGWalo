import React, { useState } from 'react';
import { LifeBuoy, Send, CheckCircle2, ImagePlus, Loader2, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { uploadListingPhoto } from '../../services/media';

export const SupportCenter: React.FC = () => {
  const { currentUser, currentResident, supportTickets, createSupportTicket, updateSupportTicket } = useApp();
  const [type, setType] = useState('General');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const isAdmin = currentUser?.role === 'superadmin' || currentUser?.role === 'admin';
  const visibleTickets = isAdmin ? supportTickets : supportTickets.filter((ticket) => ticket.requesterId === currentUser?.id);

  const onPickImage = async (file?: File) => {
    if (!file) return;
    setUploadError('');
    setUploading(true);
    try {
      // Upload to R2 (/api/media/upload). Storing a raw data URL meant a long
      // base64 string was sent through the ticket payload, where it used to be
      // truncated to 500 characters — every attachment arrived broken.
      const result = await uploadListingPhoto(file, 'Support');
      if (result.url) {
        setImageUrl(result.url);
      } else {
        setUploadError('Attachment upload failed. The ticket will still be saved without it.');
      }
    } catch {
      setUploadError('Attachment upload failed. The ticket will still be saved without it.');
    } finally {
      setUploading(false);
    }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !description.trim()) return;
    // Property-related issues carry the resident's property so the worker
    // routes them to the property's owner; everything else stays in the
    // PGWalo superadmin queue.
    const isPropertyIssue = type === 'Room allocation' || type === 'Agreement';
    createSupportTicket({
      type,
      title: title.trim(),
      description: description.trim(),
      imageUrl: imageUrl || undefined,
      propertyId: isPropertyIssue ? currentResident?.propertyId : undefined,
    });
    setTitle('');
    setDescription('');
    setImageUrl('');
    setUploadError('');
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
            {(type === 'Room allocation' || type === 'Agreement') && (
              <p className="text-[11px] text-slate-500 -mt-1">Routed to your PG's owner/manager · other issues go to the PGWalo team.</p>
            )}
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short title" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe your issue" rows={4} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 cursor-pointer hover:bg-slate-50">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                {uploading ? 'Uploading…' : imageUrl ? 'Replace photo' : 'Attach photo'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => { void onPickImage(e.target.files?.[0]); e.target.value = ''; }}
                />
              </label>
              {imageUrl && (
                <span className="inline-flex items-center gap-2 text-xs text-slate-500">
                  <img src={imageUrl} alt="Attachment preview" className="h-10 w-10 rounded-lg object-cover border border-slate-200" />
                  <button type="button" onClick={() => setImageUrl('')} className="inline-flex items-center gap-1 font-bold text-slate-500 hover:text-slate-900">
                    <X className="w-3 h-3" /> Remove
                  </button>
                </span>
              )}
            </div>
            {uploadError && <p className="text-xs font-bold text-amber-700">{uploadError}</p>}
          </div>

          <button
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            <Send className="w-4 h-4" /> Submit ticket
          </button>
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
            {ticket.imageUrl && (
              <a href={ticket.imageUrl} target="_blank" rel="noreferrer">
                <img src={ticket.imageUrl} alt="Ticket attachment" className="mt-3 max-h-48 rounded-xl border border-slate-200 object-cover" />
              </a>
            )}
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500"><CheckCircle2 className="w-4 h-4" /> {ticket.requesterName} · {new Date(ticket.createdAt).toLocaleString()}</div>
            {ticket.adminNote && <p className="mt-2 text-xs bg-slate-50 rounded-xl p-2">{ticket.adminNote}</p>}
            {(ticket.messages || []).map((message) => (
              <p key={message.id} className="mt-2 text-xs bg-indigo-50 rounded-xl p-2"><b>{message.authorName}:</b> {message.body}</p>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
