import React, { useState, useEffect } from 'react';
import { useTranslation } from '../i18n';
import { X, ToggleLeft, ToggleRight, Trash2, AlertTriangle, FileText, Box, Code, Languages, ExternalLink, Shield, Gamepad2, Palette } from 'lucide-react';

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function isChinese(text) {
  if (!text) return false;
  return /[\u4e00-\u9fff]/.test(text);
}

function getModCategory(mod, allMods) {
  const isDepForOthers = allMods.some(m => m.id !== mod.id && m.dependencies && m.dependencies.includes(mod.id));
  if (isDepForOthers) return { labelKey: 'modCard.framework', label: 'Framework prerequisite', color: 'bg-indigo-50 text-indigo-600', icon: Shield };
  if (mod.affects_gameplay || mod.has_dll) return { labelKey: 'modCard.gameplay', label: 'Gameplay change', color: 'bg-amber-50 text-amber-700', icon: Gamepad2 };
  return { labelKey: 'modCard.resources', label: 'Asset type', color: 'bg-teal-50 text-teal-600', icon: Palette };
}

export default function ModDetail({ mod, allMods, onClose, onToggle, onUninstall, onSelectMod, onTranslationSaved }) {
  const { t, language } = useTranslation();
  const enabledIds = allMods.filter(m => m.enabled).map(m => m.id);
  const missingDeps = (mod.dependencies || []).filter(d => !enabledIds.includes(d));
  const dependents = allMods.filter(m => m.dependencies && m.dependencies.includes(mod.id) && m.enabled);
  const category = getModCategory(mod, allMods);
  const CategoryIcon = category.icon;

  const [translatedDesc, setTranslatedDesc] = useState(null);
  const [translatedName, setTranslatedName] = useState(null);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState(null);

  // Load saved translations when mod changes
  useEffect(() => {
    setTranslateError(null);
    if (window.api.loadTranslations) {
      window.api.loadTranslations().then(saved => {
        const t = saved[mod.id];
        if (t) {
          setTranslatedName(t.name || null);
          setTranslatedDesc(t.desc || null);
        } else {
          setTranslatedName(null);
          setTranslatedDesc(null);
        }
      }).catch(() => {
        setTranslatedName(null);
        setTranslatedDesc(null);
      });
    } else {
      setTranslatedName(null);
      setTranslatedDesc(null);
    }
  }, [mod.id, mod.instanceKey]);

  const handleTranslate = async () => {
    setTranslating(true);
    setTranslateError(null);
    try {
      const descText = mod.description || '';
      const nameText = mod.name || '';
      const results = await Promise.all([
        !isChinese(descText) && descText ? window.api.translateText(descText) : null,
        !isChinese(nameText) && nameText ? window.api.translateText(nameText) : null,
      ]);
      let newName = translatedName, newDesc = translatedDesc;
      if (results[0]?.success) { newDesc = results[0].translated; setTranslatedDesc(newDesc); }
      if (results[1]?.success) { newName = results[1].translated; setTranslatedName(newName); }
      if (results[0] && !results[0].success) setTranslateError(results[0].error);
      // Persist
      if (window.api.saveTranslations && (newName || newDesc)) {
        const saved = await window.api.loadTranslations();
        saved[mod.id] = { name: newName, desc: newDesc };
        await window.api.saveTranslations(saved);
        if (onTranslationSaved) onTranslationSaved();
      }
    } catch (e) {
      setTranslateError(e.message);
    }
    setTranslating(false);
  };

  const hasEnglishContent = !isChinese(mod.description) || !isChinese(mod.name);

  return (
    <div className="w-80 bg-white border-l border-gray-100 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
        <div className="min-w-0 flex-1 mr-2">
          <h2 className="font-bold text-base truncate">{language.canTranslate() && translatedName || mod.name}</h2>
          {language.canTranslate() && translatedName && <p className="text-[11px] text-gray-400 truncate">{mod.name}</p>}
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">{t('modDetail.status', 'Status')}</span>
          <button onClick={onToggle} className="flex items-center gap-2">
            {mod.enabled
              ? <><span className="text-sm text-emerald-600 font-medium">{t('modDetail.enabled', 'Enabled')}</span><ToggleRight size={24} className="text-emerald-500" /></>
              : <><span className="text-sm text-gray-400 font-medium">{t('modDetail.disabled', 'Disabled')}</span><ToggleLeft size={24} className="text-gray-300" /></>
            }
          </button>
        </div>

        {/* Category badge */}
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${category.color}`}>
            <CategoryIcon size={13} /> {t(category.labelKey, category.label)}
          </span>
          {missingDeps.length > 0 && mod.enabled && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-red-50 text-red-600">
              <AlertTriangle size={13} /> {t('modDetail.missingDeps', 'Missing dependencies')}
            </span>
          )}
        </div>

        {/* Info rows */}
        <div className="space-y-3">
          {[
            ['ID', mod.id],
            [t('modDetail.author', 'Author'), mod.author || t('modDetail.unknown', 'Unknown')],
            [t('modDetail.version', 'Version'), mod.version || t('modDetail.unknown', 'Unknown')],
            [t('modDetail.size', 'Size'), formatSize(mod.size)],
            [t('modDetail.type', 'Type'), mod.isFolder ? t('modDetail.folderMod', 'Folder MOD') : t('modDetail.standaloneMod', 'Standalone MOD')],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-xs text-gray-400">{label}</span>
              <span className="text-xs text-gray-700 font-medium">{value}</span>
            </div>
          ))}
        </div>

        {/* Description */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-gray-400">{t('modDetail.description', 'Description')}</p>
            {language.canTranslate() && hasEnglishContent && (
              <button onClick={handleTranslate} disabled={translating}
                className="flex items-center gap-1 text-[11px] text-blue-500 hover:text-blue-700 disabled:text-gray-300 transition-colors">
                <Languages size={12} />
                {translating ? t('modDetail.translating', 'Translating...') : translatedDesc ? t('modDetail.retranslate', 'Retranslate') : t('modDetail.translate', 'Translate')}
              </button>
            )}
          </div>
          {language.canTranslate() && translatedDesc ? (
            <>
              <p className="text-sm text-gray-700 leading-relaxed">{translatedDesc}</p>
              <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">{mod.description}</p>
            </>
          ) : (
            <p className="text-sm text-gray-600 leading-relaxed">{mod.description || t('modDetail.noDescription', 'No description')}</p>
          )}
          {language.canTranslate() && translateError && (
            <p className="mt-1 text-xs text-red-400">{t('modDetail.translateFailed', 'Translation failed: {error}', { error: translateError })}</p>
          )}
        </div>

        {/* Dependencies */}
        {mod.dependencies && mod.dependencies.length > 0 && (
          <div>
            <p className="text-xs text-gray-400 mb-2">{t('modDetail.dependencies', 'Dependencies')}</p>
            {mod.dependencies.map(dep => {
              const isMissing = missingDeps.includes(dep);
              const depMod = allMods.find(m => m.id === dep);
              const canJump = depMod && onSelectMod;
              return (
                <div key={dep}
                  onClick={canJump ? () => onSelectMod(depMod) : undefined}
                  className={`flex items-center gap-2 py-1.5 px-3 rounded-lg text-sm mb-1 ${
                    isMissing ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                  } ${canJump ? 'cursor-pointer hover:ring-1 hover:ring-current/20 transition-all' : ''}`}>
                  {isMissing ? <AlertTriangle size={14} /> : <Box size={14} />}
                  <span className="flex-1 truncate">{depMod ? depMod.name : dep}</span>
                  {isMissing && !depMod && <span className="text-[10px] ml-auto">{t('modDetail.notInstalled', 'Not installed')}</span>}
                  {isMissing && depMod && <span className="text-[10px] ml-auto">{t('modDetail.notEnabled', 'Not enabled')}</span>}
                  {canJump && <ExternalLink size={12} className="flex-shrink-0 opacity-50" />}
                </div>
              );
            })}
          </div>
        )}

        {/* Dependents warning */}
        {dependents.length > 0 && (
          <div className="bg-amber-50 rounded-lg p-3">
            <p className="text-xs text-amber-700 font-medium mb-1">{t('modDetail.dependentsWarning', '⚠ The following mods depend on this mod')}</p>
            {dependents.map(d => (
              <p key={d.id} className="text-xs text-amber-600">{d.name}</p>
            ))}
          </div>
        )}

        {/* Files */}
        <div>
          <p className="text-xs text-gray-400 mb-2">{t('modDetail.files', 'File list')}</p>
          <div className="space-y-1">
            {(mod.files || []).map(f => (
              <div key={f} className="flex items-center gap-2 text-xs text-gray-500 py-1">
                {f.endsWith('.dll') ? <Code size={12} /> :
                 f.endsWith('.json') ? <FileText size={12} /> :
                 <Box size={12} />}
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div className="p-4 border-t border-gray-50 space-y-2">
        <button onClick={onToggle}
          className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
            mod.enabled
              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              : 'bg-gray-900 text-white hover:bg-gray-800'
          }`}>
          {mod.enabled ? t('modDetail.disableMod', 'Disable MOD') : t('modDetail.enableMod', 'Enable MOD')}
        </button>
        <button onClick={onUninstall}
          className="w-full py-2 rounded-lg text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors flex items-center justify-center gap-2">
          <Trash2 size={14} /> {t('modDetail.uninstallMod', 'Uninstall MOD')}
        </button>
      </div>
    </div>
  );
}
