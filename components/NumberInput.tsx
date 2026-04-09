
import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface NumberInputProps {
  value: string | number;
  onChange: (val: string) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
  id?: string;
}

export const NumberInput: React.FC<NumberInputProps> = ({
  value,
  onChange,
  min = 0, // Default min to 0 to prevent negatives
  max,
  step = 1,
  placeholder,
  className = "",
  readOnly = false,
  id
}) => {
  const handleIncrement = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (readOnly) return;
    const current = value === '' ? 0 : parseFloat(value.toString());
    const next = isNaN(current) ? step : current + step;
    if (max !== undefined && next > max) return;
    onChange(next.toString());
  };

  const handleDecrement = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (readOnly) return;
    const current = value === '' ? 0 : parseFloat(value.toString());
    const next = isNaN(current) ? -step : current - step;
    
    // Strict non-negative check based on min
    if (next < min) return;
    
    onChange(next.toString());
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;
    const val = e.target.value;
    
    // Allow empty string to clear input
    if (val === '') {
      onChange(val);
      return;
    }

    // Prevent negative signs
    if (val.includes('-')) return;

    const num = parseFloat(val);
    if (!isNaN(num) && num >= min) {
      if (max !== undefined && num > max) return;
      onChange(val);
    }
  };

  return (
    <div className={`relative flex items-center bg-white border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/20 shadow-sm ${className} ${readOnly ? 'opacity-75 bg-gray-50' : ''}`}>
      <input
        id={id}
        type="number"
        value={isNaN(Number(value)) ? '' : value}
        onChange={handleInputChange}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        readOnly={readOnly}
        className={`w-full h-full px-3 py-2.5 text-gray-900 font-medium outline-none appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${readOnly ? 'bg-gray-50 cursor-default' : 'bg-white'}`}
      />
      {!readOnly && (
        <div className="flex flex-col border-l border-gray-100 bg-gray-50/50 h-full">
          <button
            type="button"
            onClick={handleIncrement}
            className="px-2 flex-1 hover:bg-white text-gray-400 hover:text-indigo-600 transition-colors flex items-center justify-center border-b border-gray-100 active:bg-gray-100"
          >
            <ChevronUp className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={handleDecrement}
            className="px-2 flex-1 hover:bg-white text-gray-400 hover:text-indigo-600 transition-colors flex items-center justify-center active:bg-gray-100"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
};

export default NumberInput;
