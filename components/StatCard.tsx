
import React from 'react';
import { Stat } from '../types';

const StatCard: React.FC<Stat> = ({ label, value, subtext, icon, color }) => {
  const isPurple = color === 'purple';
  
  return (
    <div className={`
      relative p-6 rounded-[2rem] h-48 flex flex-col justify-between transition-all duration-300 hover:shadow-lg
      ${isPurple ? 'bg-indigo-600 text-white' : 'bg-white text-gray-900 border border-gray-100 shadow-sm'}
    `}>
      <div>
        <div className="flex justify-between items-start">
          <p className={`text-sm font-medium ${isPurple ? 'text-indigo-100' : 'text-gray-500'}`}>
            {label}
          </p>
          <div className={`p-3 rounded-2xl ${isPurple ? 'bg-indigo-500/50' : 'bg-gray-100 text-gray-600'}`}>
            {icon}
          </div>
        </div>
        <h3 className="text-4xl font-bold mt-2">{value}</h3>
      </div>
      <p className={`text-sm ${isPurple ? 'text-indigo-100' : 'text-gray-400'}`}>
        {subtext}
      </p>
    </div>
  );
};

export default StatCard;
