import React, { useState, useEffect } from 'react';
import { useTranslation } from '../i18n';
import { FileText, RefreshCw, ChevronDown } from 'lucide-react';

function colorLine(line) {
  if (line.includes('[ERROR]')) return 'text-red-600 bg-red-50';
  if (line.includes('[WARN]')) return 'text-amber-600 bg-amber-50';
  if (line.includes('[INFO]')) return 'text-gray-600';
  return 'text-gray-400';
}

const MAX_VISIBLE_LINES = 2000;

export default function LogViewer() {
  const { t } = useTranslation();
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState('');
  const [content, setContent] = useState('');
  const [filterLevel, setFilterLevel] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(MAX_VISIBLE_LINES);

  const loadLogs = async () => {
    setLoading(true);
    const data = await window.api.getLatestLogs();
    setFiles(data.files);
    setContent(data.content);
    if (data.files.length > 0) setSelectedFile(data.files[0]);
    setLoading(false);
  };

  useEffect(() => { loadLogs(); }, []);

  const handleFileChange = async (fileName) => {
    setSelectedFile(fileName);
    setLoading(true);
    setVisibleCount(MAX_VISIBLE_LINES);
    const c = await window.api.readLog(fileName);
    setContent(c);
    setLoading(false);
  };

  const lines = content.split('\n').filter(line => {
    if (filterLevel === 'error' && !line.includes('[ERROR]')) return false;
    if (filterLevel === 'warn' && !line.includes('[WARN]') && !line.includes('[ERROR]')) return false;
    if (search && !line.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const errorCount = content.split('\n').filter(l => l.includes('[ERROR]')).length;
  const warnCount = content.split('\n').filter(l => l.includes('[WARN]')).length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-8 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">{t('logViewer.title', 'Game Logs')}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {errorCount > 0 && <span className="text-red-500 font-medium">{t('logViewer.errorsCount', '{count} errors', { count: errorCount })}</span>}
              {errorCount > 0 && warnCount > 0 && ' · '}
              {warnCount > 0 && <span className="text-amber-500 font-medium">{t('logViewer.warningsCount', '{count} warnings', { count: warnCount })}</span>}
              {errorCount === 0 && warnCount === 0 && t('logViewer.noIssues', 'No errors or warnings')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadLogs}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> {t('logViewer.refresh', 'Refresh')}
            </button>
            <button onClick={() => window.api.openLogsDir()}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors">
              <FileText size={16} /> {t('logViewer.openFolder', 'Open Folder')}
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {/* File selector */}
          <div className="relative">
            <select value={selectedFile} onChange={(e) => handleFileChange(e.target.value)}
              className="appearance-none bg-white border border-gray-200 rounded-lg pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200">
              {files.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          {/* Filter */}
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {[['all', t('logViewer.filter.all', 'All')], ['warn', t('logViewer.filter.warn', 'Warnings+')], ['error', t('logViewer.filter.error', 'Errors only')]].map(([key, label]) => (
              <button key={key}
                onClick={() => setFilterLevel(key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  filterLevel === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>
                {label}
              </button>
            ))}
          </div>

          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('logViewer.searchPlaceholder', 'Search logs...')}
            className="flex-1 max-w-xs px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
          />
        </div>
      </div>

      {/* Log content */}
      <div className="flex-1 overflow-y-auto px-8 pb-6">
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="font-mono text-xs leading-6">
            {lines.slice(0, visibleCount).map((line, i) => (
              <div key={i} className={`px-4 py-0.5 border-b border-gray-50 ${colorLine(line)}`}>
                <span className="text-gray-300 mr-3 select-none">{String(i + 1).padStart(3, ' ')}</span>
                {line}
              </div>
            ))}
            {lines.length > visibleCount && (
              <button
                onClick={() => setVisibleCount(c => c + MAX_VISIBLE_LINES)}
                className="w-full px-4 py-3 text-center text-sm text-blue-600 hover:bg-blue-50 transition-colors">
                {t('logViewer.loadMore', 'Load {count} more lines', { count: lines.length - visibleCount })}
              </button>
            )}
            {lines.length === 0 && (
              <div className="px-4 py-8 text-center text-gray-400">{t('logViewer.noLogs', 'No log content')}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
