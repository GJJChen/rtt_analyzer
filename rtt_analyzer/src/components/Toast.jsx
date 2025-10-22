import React, { useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const Toast = ({ message, type = 'info', onClose, duration, theme = 'colorful' }) => {
  // 根据类型设置默认持续时间
  const getDefaultDuration = () => {
    switch (type) {
      case 'success':
        return 750; // 成功提示 0.1 秒（瞬间消失 - 测试用）
      case 'error':
        return 8000; // 错误提示 8 秒（持续更久）
      case 'warning':
        return 5000; // 警告提示 5 秒
      case 'info':
      default:
        return 4000; // 信息提示 4 秒
    }
  };

  const finalDuration = duration !== undefined ? duration : getDefaultDuration();

  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, finalDuration);

    return () => clearTimeout(timer);
  }, [finalDuration, onClose]);

  const types = theme === 'blackgold' ? {
    success: {
      icon: CheckCircle,
      bgColor: 'bg-gradient-to-r from-[#C79B45] to-[#b8893d]',
      iconColor: 'text-black',
    },
    error: {
      icon: XCircle,
      bgColor: 'bg-gradient-to-r from-[#C79B45]/90 to-[#a07834]',
      iconColor: 'text-black',
    },
    warning: {
      icon: AlertTriangle,
      bgColor: 'bg-gradient-to-r from-[#C79B45]/85 to-[#b8893d]/90',
      iconColor: 'text-black',
    },
    info: {
      icon: Info,
      bgColor: 'bg-gradient-to-r from-[#C79B45] to-[#d4a850]',
      iconColor: 'text-black',
    },
  } : {
    success: {
      icon: CheckCircle,
      bgColor: 'bg-gradient-to-r from-green-500 to-emerald-500',
      iconColor: 'text-white',
    },
    error: {
      icon: XCircle,
      bgColor: 'bg-gradient-to-r from-red-500 to-rose-500',
      iconColor: 'text-white',
    },
    warning: {
      icon: AlertTriangle,
      bgColor: 'bg-gradient-to-r from-yellow-500 to-orange-500',
      iconColor: 'text-white',
    },
    info: {
      icon: Info,
      bgColor: 'bg-gradient-to-r from-blue-500 to-cyan-500',
      iconColor: 'text-white',
    },
  };

  const config = types[type] || types.info;
  const Icon = config.icon;

  return (
    <div className={`${config.bgColor} ${theme === 'blackgold' ? 'text-black' : 'text-white'} px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 min-w-[320px] max-w-md animate-slide-in-right`}>
      <Icon size={24} className={config.iconColor} />
      <p className="flex-1 text-sm font-medium">{message}</p>
      <button
        onClick={onClose}
        className={`ml-2 rounded-full p-1 transition-colors ${
          theme === 'blackgold' ? 'hover:bg-black/20' : 'hover:bg-white/20'
        }`}
      >
        <X size={18} />
      </button>
    </div>
  );
};

const ToastContainer = ({ toasts, removeToast, theme = 'colorful' }) => {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-3">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
          duration={toast.duration}
          theme={theme}
        />
      ))}
    </div>
  );
};

export { Toast, ToastContainer };
