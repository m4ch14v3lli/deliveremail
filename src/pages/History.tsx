import React, { useEffect, useState } from 'react';
import { Header } from '../components/Header';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, Calendar, ShieldCheck, Download, Eye, Trash2, PhoneCall, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

interface SavedAudit {
  id: number;
  domain: string;
  score: number;
  grade: string;
  timestamp: string;
  resultData: string;
}

export const History: React.FC = () => {
  const { user, getToken } = useAuth();
  const [audits, setAudits] = useState<SavedAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [deleteTargetAudit, setDeleteTargetAudit] = useState<SavedAudit | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const getEffectiveToken = async (): Promise<string | null> => {
    try {
      const t = await getToken();
      if (t && t !== 'null' && t !== 'undefined') return t;
    } catch {}
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('app_auth_jwt_token');
      if (stored && stored !== 'null' && stored !== 'undefined') return stored;
    }
    return null;
  };

  const fetchAudits = async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);
      const token = await getEffectiveToken();
      if (!token) {
        setLoading(false);
        return;
      }

      const res = await fetch('/api/audits', {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        console.warn('Non-JSON response from /api/audits:', res.status);
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch saved audits');
      }

      setAudits(data.audits || []);
    } catch (err: any) {
      console.error('Failed to fetch audits:', err);
      setError(err.message || 'Unable to load audit history. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAudits();
  }, [user]);

  const handleExport = (e: React.MouseEvent, resultData: string, domain: string) => {
    e.stopPropagation();
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(resultData);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `audit-${domain}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleViewAudit = (audit: SavedAudit) => {
    try {
      const parsedData = JSON.parse(audit.resultData);
      navigate('/', { state: { auditData: parsedData } });
    } catch (err) {
      console.error('Failed to parse audit data', err);
    }
  };

  // In-app single delete without window.confirm
  const handleExecuteDelete = async (id: number) => {
    try {
      setError(null);
      const token = await getEffectiveToken();
      if (!token) return;

      const res = await fetch(`/api/audits/${id}`, {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('Server returned an unexpected response format.');
      }

      const data = await res.json();
      if (res.ok) {
        setAudits((prev) => prev.filter((a) => a.id !== id));
        setSuccessNotice('Audit record deleted.');
        setTimeout(() => setSuccessNotice(null), 3000);
      } else {
        throw new Error(data.error || 'Failed to delete audit.');
      }
    } catch (err: any) {
      console.error('Delete error:', err);
      setError(err.message || 'Failed to delete audit.');
    } finally {
      setDeleteTargetAudit(null);
    }
  };

  // Resilient Clear All with optimistic update and dual DELETE/POST support
  const handleExecuteClearAll = async () => {
    if (audits.length === 0) return;
    const backupAudits = [...audits];
    try {
      setIsClearing(true);
      setError(null);
      const token = await getEffectiveToken();
      if (!token) {
        throw new Error('Session token not found. Please log in again to clear history.');
      }

      // Optimistic update for instant visual feedback
      setAudits([]);

      // Strategy 1: DELETE /api/audits/all
      let res = await fetch('/api/audits/all', {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      // Strategy 2: Fallback to POST /api/audits/clear-all if DELETE was rejected
      if (!res.ok) {
        res = await fetch('/api/audits/clear-all', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
      }

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('Server returned an unexpected format.');
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to clear all audits.');
      }

      const deletedCount = data.count ?? backupAudits.length;
      setSuccessNotice(`Successfully cleared all ${deletedCount} audit record${deletedCount !== 1 ? 's' : ''}.`);
      setTimeout(() => setSuccessNotice(null), 4000);
    } catch (err: any) {
      console.error('Clear all error:', err);
      // Rollback to previous records on error
      setAudits(backupAudits);
      setError(err.message || 'Failed to clear all audit records.');
    } finally {
      setIsClearing(false);
    }
  };

  const filteredAudits = audits.filter(a =>
    a.domain.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Header />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Audit History</h2>
            <p className="text-xs text-gray-500 mt-0.5">Review and manage past domain deliverability scans</p>
          </div>
          <div className="flex items-center gap-3">
            {audits.length > 0 && (
              <button
                type="button"
                onClick={handleExecuteClearAll}
                disabled={isClearing}
                className="px-3.5 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-xs font-bold rounded-sm transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="Clear all saved audits at once"
              >
                {isClearing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>{isClearing ? 'Clearing History...' : `Clear Entire History (${audits.length})`}</span>
              </button>
            )}
            <Link to="/" className="text-sm font-semibold text-gray-600 hover:text-gray-900">
              Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Success toast notice */}
        {successNotice && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{successNotice}</span>
            </div>
            <button onClick={() => setSuccessNotice(null)} className="text-emerald-600 hover:text-emerald-900 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-red-600 hover:text-red-900 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {audits.length > 0 && (
          <div className="flex items-center justify-between gap-4">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search audited domains..."
              className="px-3 py-1.5 text-xs border border-gray-300 rounded-sm bg-white focus:ring-1 focus:ring-gray-900 focus:border-gray-900 w-64"
            />
            <span className="text-xs text-gray-500 font-medium">
              Showing {filteredAudits.length} of {audits.length} record{audits.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : audits.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-gray-300 rounded-sm bg-white">
            <ShieldCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-gray-900">No Audits Found</h3>
            <p className="text-xs text-gray-500 mt-1">Run an audit on the dashboard or bulk audit to save history.</p>
          </div>
        ) : filteredAudits.length === 0 ? (
          <div className="text-center py-8 border border-gray-200 rounded-sm bg-white text-xs text-gray-500">
            No audit records match "{searchQuery}".
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="py-3 px-4 text-xs font-bold text-gray-600 uppercase tracking-wider">Domain</th>
                  <th className="py-3 px-4 text-xs font-bold text-gray-600 uppercase tracking-wider">Date</th>
                  <th className="py-3 px-4 text-xs font-bold text-gray-600 uppercase tracking-wider">Score</th>
                  <th className="py-3 px-4 text-xs font-bold text-gray-600 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredAudits.map((audit) => (
                  <tr
                    key={audit.id}
                    onClick={() => handleViewAudit(audit)}
                    className="hover:bg-gray-50 transition-colors cursor-pointer group"
                  >
                    <td className="py-4 px-4 font-mono text-sm text-gray-900">{audit.domain}</td>
                    <td className="py-4 px-4 text-sm text-gray-600 flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(audit.timestamp).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-4 text-sm font-bold">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-bold ${
                          audit.grade === 'A'
                            ? 'bg-green-100 text-green-800'
                            : audit.grade === 'B'
                            ? 'bg-blue-100 text-blue-800'
                            : audit.grade === 'C'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {audit.score} / 100 ({audit.grade})
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/outreach?domain=${audit.domain}`, {
                            state: {
                              domain: audit.domain,
                              auditData: audit.resultData
                            }
                          });
                        }}
                        className="p-1.5 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-sm transition-colors inline-flex items-center gap-1 text-xs font-semibold"
                        title="Generate Phone Outreach Script"
                      >
                        <PhoneCall className="w-3.5 h-3.5" /> Call Script
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewAudit(audit);
                        }}
                        className="p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 rounded-sm transition-colors opacity-0 group-hover:opacity-100 inline-flex items-center gap-1 text-xs font-medium"
                        title="View Full Audit"
                      >
                        <Eye className="w-4 h-4" /> View
                      </button>
                      <button
                        onClick={(e) => handleExport(e, audit.resultData, audit.domain)}
                        className="p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 rounded-sm transition-colors inline-flex"
                        title="Export JSON"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTargetAudit(audit);
                        }}
                        className="p-1.5 text-red-400 hover:bg-red-50 hover:text-red-700 rounded-sm transition-colors inline-flex"
                        title="Delete Record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* In-App Confirmation Modal: Single Record Delete */}
      {deleteTargetAudit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-sm border border-gray-200 shadow-xl max-w-sm w-full p-5 space-y-3">
            <div className="flex items-start gap-3">
              <span className="p-2 bg-red-100 text-red-700 rounded-sm shrink-0">
                <Trash2 className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Delete Audit Record</h3>
                <p className="text-xs text-gray-600 mt-1">
                  Are you sure you want to remove the audit for <strong className="font-mono">{deleteTargetAudit.domain}</strong>?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setDeleteTargetAudit(null)}
                className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-sm cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleExecuteDelete(deleteTargetAudit.id)}
                className="px-3 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-sm flex items-center gap-1 cursor-pointer shadow-xs"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
