'use client';

import { ReactNode } from 'react';

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  subValue?: string;
  variant?: 'default' | 'primary' | 'highlight';
  large?: boolean;
}

export default function StatCard({
  icon,
  label,
  value,
  subValue,
  variant = 'default',
  large = false,
}: StatCardProps) {
  const variants = {
    default: 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700',
    primary: 'bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800',
    highlight: 'bg-gradient-to-br from-blue-500 to-blue-600 text-white',
  };

  const textColors = {
    default: 'text-gray-600 dark:text-gray-400',
    primary: 'text-blue-600 dark:text-blue-400',
    highlight: 'text-blue-100',
  };

  const valueColors = {
    default: 'text-gray-900 dark:text-white',
    primary: 'text-blue-700 dark:text-blue-300',
    highlight: 'text-white',
  };

  const iconColors = {
    default: 'text-gray-400 dark:text-gray-500',
    primary: 'text-blue-500 dark:text-blue-400',
    highlight: 'text-white/80',
  };

  return (
    <div className={`rounded-2xl p-4 ${variants[variant]} transition-all duration-200`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={iconColors[variant]}>{icon}</span>
        <span className={`text-xs font-medium uppercase tracking-wide ${textColors[variant]}`}>
          {label}
        </span>
      </div>
      <div className={`font-bold ${large ? 'text-4xl' : 'text-2xl'} ${valueColors[variant]}`}>
        {value}
      </div>
      {subValue && (
        <div className={`${large ? 'text-base' : 'text-sm'} mt-1 ${textColors[variant]}`}>
          {subValue}
        </div>
      )}
    </div>
  );
}
