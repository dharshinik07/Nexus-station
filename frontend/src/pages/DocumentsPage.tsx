import React, { useState, useEffect } from 'react';
import {
  FolderLock,
  Plus,
  Download,
  Trash2,
  Lock,
  FileText,
  AlertCircle,
  Calendar,
  Loader2,
  X,
  ShieldCheck,
} from 'lucide-react';
import { apiRequest, downloadBlob } from '../api/client';
import { DocumentItem, Client, Project } from '../types';

export const DocumentsPage: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [docTypeFilter, setDocTypeFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState('CONTRACT');
  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [tags, setTags] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      let url = `/documents?docType=${docTypeFilter}`;
      const [docRes, clientRes, projRes] = await Promise.all([
        apiRequest<{ success: boolean; data: DocumentItem[] }>(url),
        apiRequest<{ success: boolean; data: Client[] }>('/clients'),
        apiRequest<{ success: boolean; data: Project[] }>('/projects'),
      ]);
      if (docRes.data) setDocuments(docRes.data);
      if (clientRes.data) setClients(clientRes.data);
      if (projRes.data) setProjects(projRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [docTypeFilter]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setFormError('Please select a file to upload');
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title || file.name);
      formData.append('docType', docType);
      if (clientId) formData.append('clientId', clientId);
      if (projectId) formData.append('projectId', projectId);
      formData.append('tags', tags);
      if (expiresAt) formData.append('expiresAt', expiresAt);
      if (notes) formData.append('notes', notes);

      await apiRequest('/documents', {
        method: 'POST',
        body: formData,
      });

      setModalOpen(false);
      fetchDocuments();
    } catch (err: any) {
      setFormError(err.message || 'Failed to upload document');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = async (id: string, originalFilename: string) => {
    try {
      const blob = await apiRequest<Blob>(`/documents/${id}/download`);
      downloadBlob(blob, originalFilename);
    } catch (err: any) {
      alert(err.message || 'Failed to download encrypted file');
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Move "${title}" to recycle bin?`)) return;
    try {
      await apiRequest(`/documents/${id}`, { method: 'DELETE' });
      fetchDocuments();
    } catch (err: any) {
      alert(err.message || 'Failed to delete document');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <span>Documents Vault</span>
            <Lock className="w-5 h-5 text-emerald-500" />
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Encrypted file storage for contracts, NDAs, proposals, and identity documents
          </p>
        </div>

        <button
          onClick={() => {
            setTitle('');
            setFile(null);
            setTags('');
            setExpiresAt('');
            setNotes('');
            setFormError('');
            setModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-xl shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Upload Document</span>
        </button>
      </div>

      {/* Security Banner */}
      <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-2xl flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            Every document is encrypted at rest using individual AES-256-GCM cipher streams before storage on disk outside the public root.
          </span>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {['ALL', 'CONTRACT', 'NDA', 'PROPOSAL', 'TAX', 'ID_VERIFICATION', 'OTHER'].map((type) => (
          <button
            key={type}
            onClick={() => setDocTypeFilter(type)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              docTypeFilter === type
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
            }`}
          >
            {type.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Document Grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
        </div>
      ) : documents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-brand-600">
                    <FileText className="w-6 h-6" />
                  </div>
                  <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {doc.docType.replace('_', ' ')}
                  </span>
                </div>

                <div className="mt-3">
                  <h3 className="font-bold text-slate-900 dark:text-white text-base truncate">
                    {doc.title}
                  </h3>
                  <div className="text-xs text-slate-400 truncate mt-0.5">
                    {doc.originalFilename} • {(doc.fileSize / 1024).toFixed(0)} KB
                  </div>
                </div>

                {doc.client && (
                  <div className="text-xs text-brand-600 dark:text-brand-400 font-medium mt-2">
                    Client: {doc.client.name}
                  </div>
                )}

                {/* Expiry Alert */}
                {doc.expiresAt && (
                  <div
                    className={`flex items-center gap-1.5 mt-3 text-xs ${
                      doc.isExpired
                        ? 'text-rose-600 font-semibold'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>
                      {doc.isExpired ? 'Expired on' : 'Expires on'}{' '}
                      {new Date(doc.expiresAt).toLocaleDateString()}
                    </span>
                  </div>
                )}

                {/* Tags */}
                {doc.tags && doc.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {doc.tags.map((t) => (
                      <span
                        key={t}
                        className="px-2 py-0.5 text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 rounded"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <button
                  onClick={() => handleDownload(doc.id, doc.originalFilename)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/40 dark:text-brand-300 rounded-lg transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Decrypt & Download</span>
                </button>

                <button
                  onClick={() => handleDelete(doc.id, doc.title)}
                  className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <FolderLock className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <h3 className="font-semibold text-slate-900 dark:text-white">Vault is empty</h3>
          <p className="text-sm text-slate-500 mt-1">
            Store your confidential agreements, client NDAs, and tax filings securely.
          </p>
        </div>
      )}

      {/* Upload Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white">Upload Encrypted Document</h3>
              <button onClick={() => setModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleUpload} className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
              {formError && (
                <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-950/40 rounded-lg">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  Document Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Master Services Agreement 2026"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  File Attachment *
                </label>
                <input
                  type="file"
                  required
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    Document Type
                  </label>
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
                  >
                    <option value="CONTRACT">Contract / MSA</option>
                    <option value="NDA">NDA</option>
                    <option value="PROPOSAL">Proposal / SOW</option>
                    <option value="TAX">Tax Document</option>
                    <option value="ID_VERIFICATION">ID / Passport / License</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    Expiry Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    Linked Client
                  </label>
                  <select
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
                  >
                    <option value="">None</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    Tags (Comma-separated)
                  </label>
                  <input
                    type="text"
                    placeholder="signed, 2026, legal"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-xl"
                >
                  {submitting ? 'Encrypting & Storing...' : 'Save Document'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
