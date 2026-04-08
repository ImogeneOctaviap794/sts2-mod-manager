import React from 'react';
import { Minus, Square, X, Github } from 'lucide-react';

export default function TitleBar() {
  return (
    <div className="titlebar flex items-center justify-between h-10 bg-gray-900 px-4 select-none">
      <div className="flex items-center gap-2">
        <span className="text-white text-sm font-semibold tracking-wide">STS2 Mod Manager</span>
      </div>
      <div className="flex items-center">
        <button onClick={() => window.api.openUrl('https://github.com/ImogeneOctaviap794/sts2-mod-manager')}
          className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          title="GitHub">
          <Github size={14} />
        </button>
        <button onClick={() => window.api.minimize()}
          className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
          <Minus size={14} />
        </button>
        <button onClick={() => window.api.maximize()}
          className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
          <Square size={12} />
        </button>
        <button onClick={() => window.api.close()}
          className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-red-600 transition-colors">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
