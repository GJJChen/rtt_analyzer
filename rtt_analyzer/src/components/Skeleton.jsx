import React from 'react';

const Skeleton = ({ className = '', variant = 'text' }) => {
  const variants = {
    text: 'h-4 rounded',
    title: 'h-8 rounded',
    circle: 'rounded-full',
    rect: 'rounded-lg',
  };

  return (
    <div
      className={`animate-pulse bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 bg-[length:200%_100%] ${variants[variant]} ${className}`}
      style={{
        animation: 'shimmer 2s infinite linear',
      }}
    />
  );
};

const ChartSkeleton = () => {
  return (
    <div className="h-96 flex flex-col gap-4 p-6">
      <div className="flex justify-between items-center">
        <Skeleton variant="title" className="w-32" />
        <Skeleton variant="rect" className="w-24 h-8" />
      </div>
      <div className="flex-1 flex items-end gap-2">
        {[...Array(12)].map((_, i) => (
          <Skeleton
            key={i}
            variant="rect"
            className="flex-1"
            style={{ height: `${Math.random() * 60 + 20}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between">
        <Skeleton variant="text" className="w-16" />
        <Skeleton variant="text" className="w-16" />
      </div>
    </div>
  );
};

const TableSkeleton = ({ rows = 6, cols = 7 }) => {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex gap-4">
        {[...Array(cols)].map((_, i) => (
          <Skeleton key={i} variant="rect" className="flex-1 h-10" />
        ))}
      </div>
      {/* Rows */}
      {[...Array(rows)].map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4">
          {[...Array(cols)].map((_, colIndex) => (
            <Skeleton key={colIndex} variant="text" className="flex-1 h-6" />
          ))}
        </div>
      ))}
    </div>
  );
};

const StatCardSkeleton = () => {
  return (
    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-2">
      <Skeleton variant="text" className="w-16 h-3" />
      <Skeleton variant="title" className="w-24 h-6" />
      <Skeleton variant="text" className="w-20 h-3" />
    </div>
  );
};

export { Skeleton, ChartSkeleton, TableSkeleton, StatCardSkeleton };
