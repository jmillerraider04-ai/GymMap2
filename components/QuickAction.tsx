
import React from 'react';
import { ChevronRight } from 'lucide-react';
import { QuickActionType } from '../types';

const QuickAction: React.FC<QuickActionType> = ({ label, icon, onClick, primary }) => {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center justify-between p-4 rounded-xl transition-all duration-200 group
        ${primary 
          ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
          : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-100'}
      `}
    >
      <div className="flex items-center gap-4">
        <div className={`p-2 rounded-lg ${primary ? 'bg-indigo-500/50' : 'bg-gray-100 text-gray-600'}`}>
          {icon}
        </div>
        <span className="font-semibold text-sm">{label}</span>
      </div>
      <ChevronRight className={`w-5 h-5 transition-transform group-hover:translate-x-1 ${primary ? 'text-white' : 'text-gray-400'}`} />
    </button>
  );
};

export default QuickAction;
