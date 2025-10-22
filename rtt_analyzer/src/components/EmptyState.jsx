import React from 'react';
import { BarChart2, Table, TrendingUp, FileX, Inbox } from 'lucide-react';

const EmptyState = ({ type = 'default', title, description, theme = 'colorful' }) => {
  const states = theme === 'blackgold' ? {
    chart: {
      icon: BarChart2,
      defaultTitle: '暂无图表数据',
      defaultDesc: '拖入 CSV 文件开始分析',
      gradient: 'from-[#C79B45] to-[#b8893d]',
    },
    table: {
      icon: Table,
      defaultTitle: '暂无对比数据',
      defaultDesc: '处理文件后会自动记录对比数据',
      gradient: 'from-[#C79B45] to-[#d4a850]',
    },
    trend: {
      icon: TrendingUp,
      defaultTitle: '暂无趋势数据',
      defaultDesc: '需要至少 2 次分析记录才能显示趋势',
      gradient: 'from-[#C79B45] to-[#b8893d]',
    },
    default: {
      icon: Inbox,
      defaultTitle: '暂无数据',
      defaultDesc: '开始使用以查看内容',
      gradient: 'from-[#C79B45]/80 to-[#a07834]',
    },
  } : {
    chart: {
      icon: BarChart2,
      defaultTitle: '暂无图表数据',
      defaultDesc: '拖入 CSV 文件开始分析',
      gradient: 'from-blue-400 to-cyan-400',
    },
    table: {
      icon: Table,
      defaultTitle: '暂无对比数据',
      defaultDesc: '处理文件后会自动记录对比数据',
      gradient: 'from-purple-400 to-pink-400',
    },
    trend: {
      icon: TrendingUp,
      defaultTitle: '暂无趋势数据',
      defaultDesc: '需要至少 2 次分析记录才能显示趋势',
      gradient: 'from-green-400 to-emerald-400',
    },
    default: {
      icon: Inbox,
      defaultTitle: '暂无数据',
      defaultDesc: '开始使用以查看内容',
      gradient: 'from-gray-400 to-slate-400',
    },
  };

  const config = states[type] || states.default;
  const Icon = config.icon;

  return (
    <div className="h-72 md:h-80 flex flex-col items-center justify-center text-center px-4">
      <div className={`mb-4 p-4 md:p-5 rounded-full bg-gradient-to-br ${config.gradient} bg-opacity-10 backdrop-blur-sm`}>
        <Icon size={48} className={`${theme === 'blackgold' ? 'text-gold' : `text-transparent bg-gradient-to-br ${config.gradient} bg-clip-text`}`} strokeWidth={1.5} />
      </div>
      <h3 className={`text-lg md:text-xl font-semibold mb-1.5 ${
        theme === 'blackgold' ? 'text-gold' : 'text-gray-700 dark:text-gray-300'
      }`}>
        {title || config.defaultTitle}
      </h3>
      <p className={`text-xs md:text-sm max-w-md ${
        theme === 'blackgold' ? 'text-gold/60' : 'text-gray-500 dark:text-gray-400'
      }`}>
        {description || config.defaultDesc}
      </p>
    </div>
  );
};

export default EmptyState;
