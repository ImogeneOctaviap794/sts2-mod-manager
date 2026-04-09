import React from 'react';
import { useTranslation } from '../i18n';
import { ToggleLeft, ToggleRight, AlertTriangle, GripVertical, Blocks, Gamepad2, Palette, Shield } from 'lucide-react';

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getMissingDeps(mod, allMods) {
  if (!mod.dependencies || mod.dependencies.length === 0) return [];
  const enabledIds = allMods.filter(m => m.enabled).map(m => m.id);
  return mod.dependencies.filter(dep => !enabledIds.includes(dep));
}

function getModCategory(mod, allMods) {
  const isDepForOthers = allMods.some(m => m.id !== mod.id && m.dependencies && m.dependencies.includes(mod.id));
  if (isDepForOthers) return { labelKey: 'modListItem.framework', label: 'Framework', color: 'bg-indigo-50 text-indigo-600' };
  if (mod.affects_gameplay || mod.has_dll) return { labelKey: 'modListItem.gameplay', label: 'Gameplay', color: 'bg-amber-50 text-amber-700' };
  return { labelKey: 'modListItem.resources', label: 'Resource', color: 'bg-teal-50 text-teal-600' };
}

export default function ModListItem({ mod, allMods, translations, selected, multiSelected, onToggle, onClick, onCheckToggle, draggable }) {
  const { t } = useTranslation();
  const missingDeps = getMissingDeps(mod, allMods);
  const category = getModCategory(mod, allMods);
  const modTranslation = translations && translations[mod.id];

  return (
    <div
      onClick={onClick}
      draggable={draggable}
      className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer border-b border-gray-50 transition-colors group ${
        selected ? 'bg-blue-50 border-l-2 border-l-blue-500' : 'hover:bg-gray-50 border-l-2 border-l-transparent'
      } ${!mod.enabled ? 'opacity-50' : ''}`}
    >
      {/* Multi-select checkbox */}
      <input
        type="checkbox"
        checked={multiSelected}
        onChange={(e) => { e.stopPropagation(); onCheckToggle(); }}
        onClick={(e) => e.stopPropagation()}
        className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-400 flex-shrink-0 cursor-pointer"
      />

      {/* Drag handle */}
      {draggable && (
        <GripVertical size={14} className="text-gray-300 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium truncate">{(modTranslation && modTranslation.name) || mod.name}</span>
          {missingDeps.length > 0 && mod.enabled && (
            <span className="flex items-center gap-0.5 text-[10px] text-red-500 font-medium flex-shrink-0">
              <AlertTriangle size={11} /> {t('modListItem.missingDeps', 'Missing deps')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-gray-400 truncate">{mod.author || t('modListItem.unknown', 'Unknown')}</span>
          <span className="text-[11px] text-gray-300">v{mod.version}</span>
          {missingDeps.length > 0 && mod.enabled && (
            <span className="text-[10px] text-red-400 truncate">{t('modListItem.missing', 'Missing: {deps}', { deps: missingDeps.join(', ') })}</span>
          )}
        </div>
      </div>

      {/* Tags */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${category.color}`}>{category.label}</span>
        {mod.has_dll && (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-500">DLL</span>
        )}
        {mod.has_pck && (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-50 text-purple-500">PCK</span>
        )}
        {mod.dependencies && mod.dependencies.length > 0 && (
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${missingDeps.length > 0 ? 'bg-red-50 text-red-500' : 'bg-orange-50 text-orange-500'}`}>
            {t('modCard.dependencies', '{count} deps', { count: mod.dependencies.length })}
          </span>
        )}
        <span className="text-[10px] text-gray-300 w-12 text-right">{formatSize(mod.size)}</span>
      </div>

      {/* Toggle */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className="flex-shrink-0"
        title={mod.enabled ? t('modCard.clickDisable', 'Click to disable') : t('modCard.clickEnable', 'Click to enable')}
      >
        {mod.enabled
          ? <ToggleRight size={24} className="text-emerald-500" />
          : <ToggleLeft size={24} className="text-gray-300" />
        }
      </button>
    </div>
  );
}
