import React from 'react';
import { useTranslation } from '../i18n';
import {
  Package, FileText, FolderOpen, Save, HardDrive, ExternalLink, Github,
} from 'lucide-react';

export default function Sidebar({ page, setPage, gamePath, onSelectGamePath, enabledCount, totalCount, gameVersion }) {
  const { t } = useTranslation();

  const navItems = [
    { id: 'mods', icon: Package, label: t('sidebar.nav.mods', 'MOD Management') },
    { id: 'saves', icon: HardDrive, label: t('sidebar.nav.saves', 'Save Manager') },
    { id: 'logs', icon: FileText, label: t('sidebar.nav.logs', 'Game Logs') },
  ];

  const quickLinks = [
    { id: 'nexus', icon: ExternalLink, label: t('sidebar.quickAccess.nexus', 'Nexus Mods'), action: () => window.api.openUrl('https://www.nexusmods.com/slaythespire2') },
    { id: 'modsDir', icon: FolderOpen, label: t('sidebar.quickAccess.modsDir', 'MOD Folder'), action: () => window.api.openModsDir() },
    { id: 'logsDir', icon: FileText, label: t('sidebar.quickAccess.logsDir', 'Log Folder'), action: () => window.api.openLogsDir() },
    { id: 'savesDir', icon: Save, label: t('sidebar.quickAccess.savesDir', 'Save Folder'), action: () => window.api.openSavesDir() },
  ];

  return (
    <div className="w-56 bg-white border-r border-gray-100 flex flex-col">
      {/* Nav */}
      <nav className="flex-1 px-3 pt-4">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">{t('sidebar.sections.navigation', 'Navigation')}</p>
        {navItems.map(item => (
          <button key={item.id}
            onClick={() => setPage(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium mb-0.5 transition-colors ${
              page === item.id
                ? 'bg-gray-900 text-white'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}>
            <item.icon size={18} />
            {item.label}
          </button>
        ))}

        <div className="h-px bg-gray-100 my-4" />

        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">{t('sidebar.sections.quickAccess', 'Quick Access')}</p>
        {quickLinks.map(item => (
          <button key={item.id}
            onClick={item.action}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors mb-0.5">
            <item.icon size={16} />
            {item.label}
          </button>
        ))}
      </nav>

      {/* Game path */}
      <div className="p-3 border-t border-gray-100">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-semibold text-gray-400 uppercase">{t('sidebar.gamePath', 'Game Path')}</p>
            <button onClick={onSelectGamePath}
              className="text-[10px] text-blue-500 hover:text-blue-700 font-medium transition-colors"
              title={t('titleBar.selectLanguage', 'Select Language')}>
              {t('sidebar.change', 'Change')}
            </button>
          </div>
          {gamePath ? (
            <p className="text-xs text-gray-600 truncate cursor-pointer hover:text-blue-600 transition-colors"
              title={gamePath} onClick={onSelectGamePath}>{gamePath}</p>
          ) : (
            <button onClick={onSelectGamePath}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium">
              {t('sidebar.clickSelectGameDir', 'Click to select game directory')}
            </button>
          )}
          <div className="flex items-center gap-2 mt-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-[11px] text-gray-500">{t('sidebar.modsEnabledCount', '{enabled}/{total} MOD enabled', { enabled: enabledCount, total: totalCount })}</span>
          </div>
          {gameVersion && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <p className="text-[10px] text-gray-400">{t('sidebar.gameVersion', 'Game version: {version}', { version: gameVersion })}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
