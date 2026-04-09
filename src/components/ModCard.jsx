import React from 'react';
import { useTranslation } from '../i18n';
import { ToggleLeft, ToggleRight, AlertTriangle, Blocks, Gamepad2, Palette, Shield } from 'lucide-react';

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getMissingDeps(mod, allMods) {
  if (!mod.dependencies || mod.dependencies.length === 0) return [];
  const allIds = allMods.map(m => m.id);
  const enabledIds = allMods.filter(m => m.enabled).map(m => m.id);
  return mod.dependencies.map(dep => ({
    id: dep,
    installed: allIds.includes(dep),
    enabled: enabledIds.includes(dep),
  })).filter(d => !d.enabled);
}

function getModCategory(mod, allMods) {
  const isDepForOthers = allMods.some(m => m.id !== mod.id && m.dependencies && m.dependencies.includes(mod.id));
  if (isDepForOthers) return { labelKey: 'modCard.framework', label: 'Framework prerequisite', color: 'bg-indigo-50 text-indigo-600', icon: Shield };
  if (mod.affects_gameplay || mod.has_dll) return { labelKey: 'modCard.gameplay', label: 'Gameplay change', color: 'bg-amber-50 text-amber-700', icon: Gamepad2 };
  return { labelKey: 'modCard.resources', label: 'Asset type', color: 'bg-teal-50 text-teal-600', icon: Palette };
}

export default function ModCard({ mod, allMods, translations, onToggle, onClick, selected }) {
  const { t, language } = useTranslation();
  const missingDeps = getMissingDeps(mod, allMods);
  const category = getModCategory(mod, allMods);
  const CategoryIcon = category.icon;
  const modTranslation = translations && translations[mod.id];

  return (
    <div
      onClick={onClick}
      className={`relative bg-white rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md ${
        selected ? 'border-gray-900 shadow-md' : missingDeps.length > 0 ? 'border-red-200' : 'border-gray-100 hover:border-gray-200'
      } ${!mod.enabled ? 'opacity-60' : ''}`}
    >
      {/* Missing deps banner */}
      {missingDeps.length > 0 && mod.enabled && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 -mx-4 -mt-4 mb-3 bg-red-50 rounded-t-xl border-b border-red-100">
          <AlertTriangle size={12} className="text-red-500 flex-shrink-0" />
          <span className="text-[11px] text-red-600 font-medium truncate">
            {t('modCard.missingDepsBanner', 'Missing dependencies: {deps}', { deps: missingDeps.map(d => d.id).join(', ') })}
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm truncate">{(language.canTranslate() && modTranslation && modTranslation.name) || mod.name}</h3>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {mod.author} · v{mod.version}
          </p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className="flex-shrink-0 ml-2"
          title={mod.enabled ? t('modCard.clickDisable', 'Click to disable') : t('modCard.clickEnable', 'Click to enable')}
        >
          {mod.enabled
            ? <ToggleRight size={28} className="text-emerald-500" />
            : <ToggleLeft size={28} className="text-gray-300" />
          }
        </button>
      </div>

      {/* Description */}
      <p className="text-xs text-gray-500 line-clamp-2 mb-3 leading-relaxed">
        {(language.canTranslate() && modTranslation && modTranslation.desc) || mod.description || t('modCard.noDescription', 'No description')}
      </p>

      {/* Tags */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${category.color}`}>
          <CategoryIcon size={11} /> {t(category.labelKey, category.label)}
        </span>
        {!mod.enabled && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-gray-100 text-gray-500">{t('modCard.disabled', 'Disabled')}</span>
        )}
        {mod.has_dll && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 text-blue-600">DLL</span>
        )}
        {mod.has_pck && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-purple-50 text-purple-600">PCK</span>
        )}
        {mod.dependencies && mod.dependencies.length > 0 && (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${
            missingDeps.length > 0 ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'
          }`}>
            <Blocks size={11} className="mr-0.5" /> {t('modCard.dependencies', '{count} deps', { count: mod.dependencies.length })}
          </span>
        )}
        <span className="ml-auto text-[11px] text-gray-300">{formatSize(mod.size)}</span>
      </div>
    </div>
  );
}
