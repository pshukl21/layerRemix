import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Flag, Trash2, Check, X as XIcon, Loader2 } from 'lucide-react';
import { fetchReports, updateReportStatus, adminDeleteArtwork, Report } from '../lib/reports';

// Admin-only panel for reviewing user-submitted reports and, when
// warranted, actually removing the reported content — kept off the
// homepage/artwork pages entirely, same as the hero settings panel, so
// this only ever appears on the admin's own profile page.
export const AdminReportsPanel: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReports().then((data) => {
      setReports(data);
      setLoading(false);
    });
  }, []);

  const handleDismiss = async (reportId: string) => {
    setActioningId(reportId);
    setError(null);
    const { error: err } = await updateReportStatus(reportId, 'dismissed');
    setActioningId(null);
    if (err) {
      setError(err);
      return;
    }
    setReports((prev) => prev.map((r) => (r.id === reportId ? { ...r, status: 'dismissed' } : r)));
  };

  const handleTakeDown = async (report: Report) => {
    if (!window.confirm(`Permanently remove "${report.artworkTitle}"? This can't be undone.`)) return;
    setActioningId(report.id);
    setError(null);
    const { error: deleteErr } = await adminDeleteArtwork(report.artworkId);
    if (deleteErr) {
      setActioningId(null);
      setError(deleteErr);
      return;
    }
    const { error: statusErr } = await updateReportStatus(report.id, 'actioned');
    setActioningId(null);
    if (statusErr) {
      setError(statusErr);
      return;
    }
    setReports((prev) => prev.map((r) => (r.id === report.id ? { ...r, status: 'actioned' } : r)));
  };

  const pending = reports.filter((r) => r.status === 'pending');
  const resolved = reports.filter((r) => r.status !== 'pending');

  return (
    <div className="mb-10 bg-red-50/50 border border-red-200 rounded-xl p-5">
      <h2 className="text-[10px] font-bold text-red-700 uppercase tracking-widest mb-1">Admin Only</h2>
      <h3 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2">
        <Flag className="w-4 h-4 text-red-500" />
        Content Reports
        {pending.length > 0 && (
          <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{pending.length} pending</span>
        )}
      </h3>

      {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
      {error && <p className="text-xs font-semibold text-red-600 mb-3">{error}</p>}

      {!loading && reports.length === 0 && (
        <p className="text-xs text-slate-500 font-semibold">No reports yet.</p>
      )}

      <div className="flex flex-col gap-2">
        {[...pending, ...resolved].map((report) => (
          <div
            key={report.id}
            className={`bg-white border rounded-lg p-3.5 ${report.status === 'pending' ? 'border-red-200' : 'border-slate-200 opacity-60'}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  to={`/art/${report.artworkId}`}
                  className="text-xs font-bold text-blue-600 hover:underline truncate block"
                >
                  {report.artworkTitle}
                </Link>
                <p className="text-[11px] font-bold text-slate-700 mt-1">{report.reason}</p>
                {report.details && <p className="text-[11px] text-slate-500 font-semibold mt-0.5">{report.details}</p>}
                <p className="text-[10px] text-slate-400 font-semibold mt-1">
                  {report.reporterUsername ? `Reported by @${report.reporterUsername}` : 'Reported anonymously'} ·{' '}
                  {new Date(report.createdAt).toLocaleDateString()}
                </p>
              </div>
              {report.status === 'pending' && (
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => handleDismiss(report.id)}
                    disabled={actioningId === report.id}
                    title="Dismiss — no action needed"
                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-all cursor-pointer disabled:opacity-50"
                  >
                    <XIcon className="w-3.5 h-3.5 text-slate-600" />
                  </button>
                  <button
                    onClick={() => handleTakeDown(report)}
                    disabled={actioningId === report.id}
                    title="Remove this artwork"
                    className="w-8 h-8 rounded-lg bg-red-100 hover:bg-red-200 flex items-center justify-center transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-600" />
                  </button>
                </div>
              )}
              {report.status !== 'pending' && (
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
                  {report.status === 'actioned' && <Check className="w-3 h-3" />}
                  {report.status}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
