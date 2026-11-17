import React, { useState, useEffect } from 'react';
import { Trash2, RotateCcw, AlertTriangle, Loader2 } from 'lucide-react';
import { apiRequest } from '../api/client';

interface RecycledItem {
  id: string;
  type: 'CLIENT' | 'PROJECT' | 'INVOICE' | 'EXPENSE' | 'DOCUMENT';
  name: string;
  deletedAt: string;
}

export const RecycleBinPage: React.FC = () => {
  const [items, setItems] = useState<RecycledItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecycleBin = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{ success: boolean; data: RecycledItem[] }>('/settings/recycle-bin');
      if (res.data) setItems(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecycleBin();
  }, []);

  const handleRestore = async (item: RecycledItem) => {
    try {
      await apiRequest('/settings/recycle-bin/restore', {
        method: 'POST',
        body: JSON.stringify({ type: item.type, id: item.id }),
      });
      fetchRecycleBin();
    } catch (err: any) {
      alert(err.message || 'Failed to restore item');
    }
  };

  const handlePurge = async (item: RecycledItem) => {
    if (!confirm(`Permanently delete "${item.name}"? This action CANNOT be undone.`)) return;
    try {
      await apiRequest('/settings/recycle-bin/purge', {
        method: 'POST',
        body: JSON.stringify({ type: item.type, id: item.id }),
      });
      fetchRecycleBin();
    } catch (err: any) {
      alert(err.message || 'Failed to permanently delete item');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Recycle Bin
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Soft-deleted records are retained here for 30 days before permanent deletion.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
        </div>
      ) : items.length > 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Type</th>
                  <th className="px-6 py-3.5">Item Name / Summary</th>
                  <th className="px-6 py-3.5">Deleted At</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((item) => (
                  <tr key={`${item.type}-${item.id}`} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {item.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                      {item.name}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {new Date(item.deletedAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleRestore(item)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/40 dark:text-brand-300 rounded-lg"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Restore</span>
                        </button>
                        <button
                          onClick={() => handlePurge(item)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg"
                          title="Purge permanently"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <Trash2 className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <h3 className="font-semibold text-slate-900 dark:text-white">Recycle bin is empty</h3>
          <p className="text-sm text-slate-500 mt-1">No deleted clients, projects, or documents.</p>
        </div>
      )}
    </div>
  );
};
