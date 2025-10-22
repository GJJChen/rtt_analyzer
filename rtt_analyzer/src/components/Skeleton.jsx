import React from 'react';

const Skeleton = ({ className = '', variant = 'text', theme = 'colorful' }) => {
  const variants = {
    text: 'h-4 rounded',
    title: 'h-8 rounded',
    circle: 'rounded-full',
    rect: 'rounded-lg',
  };

  const gradientClass = theme === 'blackgold'
    ? 'bg-gradient-to-r from-gold/20 via-gold/30 to-gold/20'
    : 'bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700';

  return (
    <div
      className={`animate-pulse ${gradientClass} bg-[length:200%_100%] ${variants[variant]} ${className}`}
      style={{
        animation: 'shimmer 2s infinite linear',
      }}
    />
  );
};

const ChartSkeleton = ({ theme = 'colorful' }) => {
  return (
    <div className="h-96 flex flex-col gap-4 p-6">
      <div className="flex justify-between items-center">
        <Skeleton variant="title" className="w-32" theme={theme} />
        <Skeleton variant="rect" className="w-24 h-8" theme={theme} />
      </div>
      <div className="flex-1 flex items-end gap-2">
        {[...Array(12)].map((_, i) => (
          <Skeleton
            key={i}
            variant="rect"
            className="flex-1"
            style={{ height: `${Math.random() * 60 + 20}%` }}
            theme={theme}
          />
        ))}
      </div>
      <div className="flex justify-between">
        <Skeleton variant="text" className="w-16" theme={theme} />
        <Skeleton variant="text" className="w-16" theme={theme} />
      </div>
    </div>
  );
};

const TableSkeleton = ({ rows = 6, cols = 7, theme = 'colorful' }) => {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex gap-4">
        {[...Array(cols)].map((_, i) => (
          <Skeleton key={i} variant="rect" className="flex-1 h-10" theme={theme} />
        ))}
      </div>
      {/* Rows */}
      {[...Array(rows)].map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4">
          {[...Array(cols)].map((_, colIndex) => (
            <Skeleton key={colIndex} variant="text" className="flex-1 h-6" theme={theme} />
          ))}
        </div>
      ))}
    </div>
  );
};

const StatCardSkeleton = ({ theme = 'colorful' }) => {
  return (
    <div className={`p-4 rounded-lg space-y-2 ${
      theme === 'blackgold' ? 'bg-black/40' : 'bg-gray-50 dark:bg-gray-800'
    }`}>
      <Skeleton variant="text" className="w-16 h-3" theme={theme} />
      <Skeleton variant="title" className="w-24 h-6" theme={theme} />
      <Skeleton variant="text" className="w-20 h-3" theme={theme} />
    </div>
  );
};

export { Skeleton, ChartSkeleton, TableSkeleton, StatCardSkeleton };
