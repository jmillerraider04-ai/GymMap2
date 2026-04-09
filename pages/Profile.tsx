
import React from 'react';
import { User, Shield, Zap, GraduationCap, Check, Scale } from 'lucide-react';
import { KnowledgeLevel, UnitSystem } from '../types';

interface ProfileProps {
  knowledgeLevel: KnowledgeLevel;
  setKnowledgeLevel: (level: KnowledgeLevel) => void;
  unitSystem: UnitSystem;
  setUnitSystem: (unit: UnitSystem) => void;
}

const Profile: React.FC<ProfileProps> = ({ knowledgeLevel, setKnowledgeLevel, unitSystem, setUnitSystem }) => {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <header className="mb-12">
        <h1 className="text-4xl font-bold text-gray-900 tracking-tight">Account Settings</h1>
        <p className="text-gray-500 mt-2 text-lg">Manage your preferences and experience</p>
      </header>

      <div className="space-y-8">
        {/* User Info Card */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm flex items-center gap-8">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-indigo-500 to-purple-500 p-1">
            <div className="w-full h-full rounded-2xl overflow-hidden border-4 border-white">
              <img 
                src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop" 
                alt="User" 
                className="w-full h-full object-cover"
              />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Alex Johnson</h2>
            <p className="text-gray-500 font-medium">alex.j@precisionfitness.com</p>
            <div className="flex gap-2 mt-3">
              <span className="bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-lg">Pro Member</span>
              <span className="bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-lg">Active Plan</span>
            </div>
          </div>
        </div>

        {/* Unit Settings */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-8">
            <Scale className="w-6 h-6 text-indigo-600" />
            <h2 className="text-xl font-bold text-gray-900">Unit System</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button 
              onClick={() => setUnitSystem('lbs')}
              className={`
                relative p-6 rounded-3xl border-2 transition-all text-left group
                ${unitSystem === 'lbs' 
                  ? 'border-indigo-600 bg-indigo-50/30' 
                  : 'border-gray-100 bg-gray-50/50 hover:border-gray-200'}
              `}
            >
              <div className="flex justify-between items-start mb-4">
                <span className={`text-xl font-black ${unitSystem === 'lbs' ? 'text-indigo-600' : 'text-gray-400'}`}>LBS</span>
                {unitSystem === 'lbs' && <Check className="w-5 h-5 text-indigo-600" />}
              </div>
              <h3 className="font-bold text-gray-900 text-lg">Imperial</h3>
              <p className="text-gray-500 text-sm mt-1">Weight in pounds (lbs), distance in miles.</p>
            </button>

            <button 
              onClick={() => setUnitSystem('kg')}
              className={`
                relative p-6 rounded-3xl border-2 transition-all text-left group
                ${unitSystem === 'kg' 
                  ? 'border-indigo-600 bg-indigo-50/30' 
                  : 'border-gray-100 bg-gray-50/50 hover:border-gray-200'}
              `}
            >
              <div className="flex justify-between items-start mb-4">
                <span className={`text-xl font-black ${unitSystem === 'kg' ? 'text-indigo-600' : 'text-gray-400'}`}>KG</span>
                {unitSystem === 'kg' && <Check className="w-5 h-5 text-indigo-600" />}
              </div>
              <h3 className="font-bold text-gray-900 text-lg">Metric</h3>
              <p className="text-gray-500 text-sm mt-1">Weight in kilograms (kg), distance in km.</p>
            </button>
          </div>
        </div>

        {/* Experience Settings */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-8">
            <GraduationCap className="w-6 h-6 text-indigo-600" />
            <h2 className="text-xl font-bold text-gray-900">App Experience</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button 
              onClick={() => setKnowledgeLevel('noobie')}
              className={`
                relative p-6 rounded-3xl border-2 transition-all text-left group
                ${knowledgeLevel === 'noobie' 
                  ? 'border-indigo-600 bg-indigo-50/30' 
                  : 'border-gray-100 bg-gray-50/50 hover:border-gray-200'}
              `}
            >
              <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-2xl ${knowledgeLevel === 'noobie' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-400 border border-gray-100'}`}>
                  <Zap className="w-5 h-5" />
                </div>
                {knowledgeLevel === 'noobie' && <Check className="w-5 h-5 text-indigo-600" />}
              </div>
              <h3 className="font-bold text-gray-900 text-lg">Noobie</h3>
              <p className="text-gray-500 text-sm mt-1">Simplified terminology for clear, easy-to-understand guidance.</p>
            </button>

            <button 
              onClick={() => setKnowledgeLevel('advanced')}
              className={`
                relative p-6 rounded-3xl border-2 transition-all text-left group
                ${knowledgeLevel === 'advanced' 
                  ? 'border-indigo-600 bg-indigo-50/30' 
                  : 'border-gray-100 bg-gray-50/50 hover:border-gray-200'}
              `}
            >
              <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-2xl ${knowledgeLevel === 'advanced' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-400 border border-gray-100'}`}>
                  <Shield className="w-5 h-5" />
                </div>
                {knowledgeLevel === 'advanced' && <Check className="w-5 h-5 text-indigo-600" />}
              </div>
              <h3 className="font-bold text-gray-900 text-lg">Advanced</h3>
              <p className="text-gray-500 text-sm mt-1">Precise anatomical terms and detailed biomechanical analysis.</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
