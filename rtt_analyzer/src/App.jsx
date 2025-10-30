import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import { File, UploadCloud, BarChart2, Table, BrainCircuit, Moon, Sun, AlertTriangle, FolderOpen, Trash2, ExternalLink, TrendingUp, TrendingDown, Download, FolderSearch, X } from 'lucide-react';
// Tauri v2 正确的导入方式
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { writeFile } from '@tauri-apps/plugin-fs';
import { save, open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { openPath, revealItemInDir } from '@tauri-apps/plugin-opener';
import { ToastContainer } from './components/Toast';
import { ChartSkeleton, TableSkeleton, StatCardSkeleton } from './components/Skeleton';
import EmptyState from './components/EmptyState';

// --- Helper Components for UI Styling ---
const Card = ({ children, className = '', theme = 'colorful' }) => {
  const baseClass = theme === 'blackgold'
    ? 'bg-gradient-to-br from-neutral-950 via-stone-950 to-black border border-amber-600/15 shadow-2xl shadow-amber-900/20'
    : 'glass-card shadow-xl';
  
  return (
    <div className={`${baseClass} rounded-xl p-3 md:p-4 animate-fade-in ${className}`}>
      {children}
    </div>
  );
};

const TabButton = ({ children, active, onClick, theme = 'colorful' }) => {
  if (theme === 'blackgold') {
    return (
      <button
        onClick={onClick}
        className={`relative px-3 md:px-4 py-2 text-xs md:text-sm font-medium rounded-lg transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 overflow-hidden ${
          active
            ? 'text-gold font-bold bg-black/60 border border-gold/30'
            : 'text-gold/60 hover:text-gold/80 bg-black/20 hover:bg-black/40 border border-transparent'
        }`}
      >
        {children}
        {active && (
          <>
            {/* Bottom glow gradient effect */}
            <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-gold to-transparent opacity-90"></div>
            <div className="absolute bottom-0 left-0 right-0 h-[8px] bg-gradient-to-t from-gold/40 via-gold/20 to-transparent blur-[2px]"></div>
          </>
        )}
      </button>
    );
  }
  
  return (
    <button
      onClick={onClick}
      className={`px-3 md:px-4 py-2 text-xs md:text-sm font-medium rounded-lg transition-all duration-200 ease-out motion-safe:transform hover:-translate-y-0.5 active:translate-y-0 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 ${
        active
          ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30'
          : 'text-gray-600 dark:text-gray-300 hover:bg-gradient-to-r hover:from-gray-200 hover:to-gray-100 dark:hover:from-gray-700 dark:hover:to-gray-600'
      }`}
    >
      {children}
    </button>
  );
};

// --- Main Application Component ---
function App() {
  const [files, setFiles] = useState([]);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [activeTab, setActiveTab] = useState('chart');
  const [darkMode, setDarkMode] = useState(false); // 默认明亮模式
  const [theme, setTheme] = useState('colorful'); // 主题: 'colorful' (炫彩) 或 'blackgold' (黑金)
  
  // 主题切换调试
  useEffect(() => {
    console.log('🎨 当前主题:', theme);
  }, [theme]);
  
  // 黑金主题自动启用暗黑模式
  useEffect(() => {
    if (theme === 'blackgold') {
      setDarkMode(true);
    }
  }, [theme]);
  
  // 暗黑模式切换时，如果当前是黑金主题，则切换回炫彩
  const toggleDarkMode = useCallback(() => {
    if (theme === 'blackgold') {
      setTheme('colorful');
      setDarkMode(false);
    } else {
      setDarkMode(!darkMode);
    }
  }, [darkMode, theme]);
  
  const [isDragOver, setIsDragOver] = useState(false);
  const [isOverDropZone, setIsOverDropZone] = useState(false); // 是否在拖拽区域内
  const dropZoneRef = useRef(null); // 引用拖拽区域元素
  const handleFileDropRef = useRef(null); // 引用最新的 handleFileDrop 函数
  const [comparisonsData, setComparisonsData] = useState(null); // comparisons.csv 数据
  const chartRef = useRef(null); // 引用 CDF 图表 ECharts 实例
  const trendChartRef = useRef(null); // 引用趋势图表 ECharts 实例
  const [inputDir, setInputDir] = useState(''); // 输入文件根目录
  const [outputBaseDir, setOutputBaseDir] = useState(''); // 输出结果文件夹根目录
  const [contextMenu, setContextMenu] = useState(null); // 右键菜单状态
  const [comparisonsFilePath, setComparisonsFilePath] = useState(''); // comparisons.csv 完整路径
  const [backendStatus, setBackendStatus] = useState('connecting'); // 后端状态: connecting, ready, error
  const [toasts, setToasts] = useState([]); // Toast通知列表
  const [isProcessing, setIsProcessing] = useState(false); // 处理中状态
  const [isInitialized, setIsInitialized] = useState(false); // 是否已完成初始化（用于控制启动画面）
  
  // 合并数据功能状态
  const [isMergeMode, setIsMergeMode] = useState(false); // 是否处于合并模式
  const [selectedRows, setSelectedRows] = useState(new Set()); // 选中的行索引
  const [showMergePreview, setShowMergePreview] = useState(false); // 显示合并预览对话框

  // 删除数据功能状态
  const [isDeleteMode, setIsDeleteMode] = useState(false); // 是否处于删除模式
  const [deleteSelectedRows, setDeleteSelectedRows] = useState(new Set()); // 删除模式下选中的行索引

  // 趋势图表图例显示状态
  const [allTrendSeriesVisible, setAllTrendSeriesVisible] = useState(true); // 所有系列是否显示

  // Toast管理函数
  const addToast = useCallback((message, type = 'info', duration) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type, duration }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);


  // --- Dark Mode Toggle ---
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // 加载配置
  const loadConfig = useCallback(async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/get-config');
      if (response.ok) {
        const result = await response.json();
        setInputDir(result.data.input_dir || '');
        setOutputBaseDir(result.data.output_base_dir || '');
        setComparisonsFilePath(result.data.comparisons_file || '');
      }
    } catch (error) {
      console.error("Failed to load config:", error);
    }
  }, []);

  // 保存配置
  const saveConfig = useCallback(async (newInputDir, newOutputBaseDir) => {
    try {
      const response = await fetch('http://127.0.0.1:8000/save-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input_dir: newInputDir || '',
          output_base_dir: newOutputBaseDir || ''
        }),
      });
      
      if (response.ok) {
        console.log('Config saved successfully');
      }
    } catch (error) {
      console.error("Failed to save config:", error);
    }
  }, []);

  // 选择输入目录
  const selectInputDir = useCallback(async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        defaultPath: inputDir || undefined
      });
      
      if (selected) {
        setInputDir(selected);
        await saveConfig(selected, outputBaseDir);
      }
    } catch (error) {
      console.error("Failed to select input directory:", error);
    }
  }, [inputDir, outputBaseDir, saveConfig]);

  // 选择输出根目录
  const selectOutputBaseDir = useCallback(async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        defaultPath: outputBaseDir || undefined
      });
      
      if (selected) {
        setOutputBaseDir(selected);
        await saveConfig(inputDir, selected);
      }
    } catch (error) {
      console.error("Failed to select output directory:", error);
    }
  }, [inputDir, outputBaseDir, saveConfig]);

  // 打开输入目录
  const openInputDir = useCallback(async () => {
    try {
      if (!inputDir) {
        addToast('请先选择输入目录', 'warning');
        return;
      }
      await openPath(inputDir);
      console.log('Opening input directory:', inputDir);
    } catch (error) {
      console.error("Failed to open input directory:", error);
      addToast('打开目录失败: ' + error.message, 'error');
    }
  }, [inputDir, addToast]);

  // 打开输出根目录
  const openOutputBaseDir = useCallback(async () => {
    try {
      if (!outputBaseDir) {
        addToast('请先选择输出目录', 'warning');
        return;
      }
      await openPath(outputBaseDir);
      console.log('Opening output directory:', outputBaseDir);
    } catch (error) {
      console.error("Failed to open output directory:", error);
      addToast('打开目录失败: ' + error.message, 'error');
    }
  }, [outputBaseDir, addToast]);

  // 清除历史记录
  const clearComparisons = useCallback(async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/clear-comparisons', {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setComparisonsData({ rows: [], columns: [], all_rows: [] });
        addToast('历史记录已清除', 'success');
        console.log('Comparisons cleared successfully');
      }
    } catch (error) {
      console.error("Failed to clear comparisons:", error);
      addToast('清除历史记录失败: ' + error.message, 'error');
    }
  }, [addToast]);

  // 合并数据相关函数
  const toggleMergeMode = useCallback(() => {
    setIsMergeMode(prev => !prev);
    setSelectedRows(new Set());
    // 关闭删除模式
    setIsDeleteMode(false);
    setDeleteSelectedRows(new Set());
  }, []);

  const toggleRowSelection = useCallback((rowIndex) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(rowIndex)) {
        newSet.delete(rowIndex);
      } else {
        newSet.add(rowIndex);
      }
      return newSet;
    });
  }, []);

  const calculateMergedData = useMemo(() => {
    if (!comparisonsData || selectedRows.size === 0) return null;

    const selectedRowsData = Array.from(selectedRows).map(idx => comparisonsData.rows[idx]);
    const numericColumns = ['mean_ms', 'p90_ms', 'p99_ms', 'p999_ms', 'p9999_ms'];
    
    const merged = {};
    comparisonsData.columns.forEach(col => {
      if (numericColumns.includes(col)) {
        // 计算平均值
        const sum = selectedRowsData.reduce((acc, row) => acc + (row[col] || 0), 0);
        merged[col] = sum / selectedRowsData.length;
      } else if (col === 'source_file') {
        // 文件名改为：第一个文件名 + "平均"
        const firstName = selectedRowsData[0][col];
        merged[col] = `${firstName}平均`;
      } else {
        // 其他列取第一个值
        merged[col] = selectedRowsData[0][col];
      }
    });

    return merged;
  }, [comparisonsData, selectedRows]);

  const confirmMerge = useCallback(async () => {
    if (selectedRows.size < 2) {
      addToast('请至少选择两行数据进行合并', 'warning');
      return;
    }

    try {
      setIsProcessing(true);
      const response = await fetch('http://127.0.0.1:8000/merge-rows', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          row_indices: Array.from(selectedRows),
          merged_data: calculateMergedData
        }),
      });

      if (response.ok) {
        await fetchComparisons(); // 刷新数据
        setIsMergeMode(false);
        setSelectedRows(new Set());
        setShowMergePreview(false);
        addToast(`成功合并 ${selectedRows.size} 行数据`, 'success');
      } else {
        const error = await response.json();
        addToast('合并失败: ' + error.detail, 'error');
      }
    } catch (error) {
      console.error("Failed to merge rows:", error);
      addToast('合并失败: ' + error.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  }, [selectedRows, calculateMergedData, addToast]);

  // 删除数据相关函数
  const toggleDeleteMode = useCallback(() => {
    setIsDeleteMode(prev => !prev);
    setDeleteSelectedRows(new Set());
    // 关闭合并模式
    setIsMergeMode(false);
    setSelectedRows(new Set());
  }, []);

  const toggleDeleteRowSelection = useCallback((rowIndex) => {
    setDeleteSelectedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(rowIndex)) {
        newSet.delete(rowIndex);
      } else {
        newSet.add(rowIndex);
      }
      return newSet;
    });
  }, []);

  // 获取 comparisons 数据
  const fetchComparisons = useCallback(async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/get-comparisons');
      if (response.ok) {
        const result = await response.json();
        setComparisonsData(result.data);
      }
    } catch (error) {
      console.error("Failed to fetch comparisons:", error);
    }
  }, []);

  const confirmDelete = useCallback(async () => {
    if (deleteSelectedRows.size === 0) {
      addToast('请至少选择一行数据进行删除', 'warning');
      return;
    }

    try {
      setIsProcessing(true);
      const response = await fetch('http://127.0.0.1:8000/delete-rows', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          row_indices: Array.from(deleteSelectedRows)
        }),
      });

      if (response.ok) {
        await fetchComparisons(); // 刷新数据
        setIsDeleteMode(false);
        setDeleteSelectedRows(new Set());
        addToast(`成功删除 ${deleteSelectedRows.size} 行数据`, 'success');
      } else {
        const error = await response.json();
        addToast('删除失败: ' + error.detail, 'error');
      }
    } catch (error) {
      console.error("Failed to delete rows:", error);
      addToast('删除失败: ' + error.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  }, [deleteSelectedRows, addToast, fetchComparisons]);

  // 切换趋势图表所有系列的显示/隐藏
  const toggleAllTrendSeries = useCallback(() => {
    if (!trendChartRef.current) return;
    
    const chartInstance = trendChartRef.current.getEchartsInstance();
    const seriesNames = ['Mean', 'P90', 'P99', 'P99.9', 'P99.99'];
    
    // 切换状态
    const newState = !allTrendSeriesVisible;
    setAllTrendSeriesVisible(newState);
    
    // 更新图例选中状态
    seriesNames.forEach(name => {
      chartInstance.dispatchAction({
        type: newState ? 'legendSelect' : 'legendUnSelect',
        name: name
      });
    });
  }, [allTrendSeriesVisible]);

  // 处理趋势图表图例点击事件
  const handleTrendLegendChange = useCallback((params) => {
    // 检查是否有任何系列被选中
    const selected = params.selected;
    const hasAnyVisible = Object.values(selected).some(v => v === true);
    setAllTrendSeriesVisible(hasAnyVisible);
  }, []);

  // 计算每列的最大值和最小值（仅针对数值列）
  const getColumnExtremes = useMemo(() => {
    if (!comparisonsData || !comparisonsData.rows || comparisonsData.rows.length === 0) {
      return {};
    }

    const numericColumns = ['mean_ms', 'p90_ms', 'p99_ms', 'p999_ms', 'p9999_ms'];
    const extremes = {};

    numericColumns.forEach(col => {
      const values = comparisonsData.rows
        .map(row => row[col])
        .filter(val => typeof val === 'number' && !isNaN(val));
      
      if (values.length > 0) {
        extremes[col] = {
          min: Math.min(...values),
          max: Math.max(...values)
        };
      }
    });

    return extremes;
  }, [comparisonsData]);

  // 获取单元格样式类名
  const getCellStyle = useCallback((col, value) => {
    const extremes = getColumnExtremes[col];
    if (!extremes || typeof value !== 'number') {
      return 'text-gray-900 dark:text-gray-100';
    }

    if (value === extremes.max) {
      return 'text-red-600 dark:text-red-400 font-bold';
    } else if (value === extremes.min) {
      return 'text-green-600 dark:text-green-400 font-bold';
    }
    
    return 'text-gray-900 dark:text-gray-100';
  }, [getColumnExtremes]);

  // 格式化 timestamp 显示（去除年份）
  const formatTimestamp = useCallback((timestamp) => {
    if (!timestamp) return '';
    // 如果包含年份（格式：2024/01/02 12:34），则去除年份
    // 匹配格式：YYYY/MM/DD HH:MM 或 YYYY-MM-DD HH:MM
    const match = timestamp.match(/^\d{4}[/-](.+)$/);
    if (match) {
      return match[1]; // 返回去除年份后的部分
    }
    return timestamp; // 如果已经没有年份，直接返回
  }, []);

  // 限制 source_file 名称长度（最大 "sample_rtt0102 - 副本 (3)平均" 的长度）
  const formatSourceFileName = useCallback((fileName) => {
    if (!fileName) return '';
    // 确保 fileName 是字符串
    const name = String(fileName);
    const maxLength = 30; // "sample_rtt0102 - 副本 (3)平均" 约 30 字符
    if (name.length <= maxLength) {
      return name;
    }
    // 截断并添加省略号
    return name.substring(0, maxLength - 3) + '...';
  }, []);


  // 打开 comparisons.csv 文件
  const openComparisonsFile = useCallback(async () => {
    try {
      if (!comparisonsFilePath) {
        addToast('无法获取文件路径', 'warning');
        return;
      }
      // 在文件资源管理器中显示并选中 comparisons.csv 文件
      await revealItemInDir(comparisonsFilePath);
      console.log('Revealing comparisons.csv in explorer...');
    } catch (error) {
      console.error("Failed to open comparisons file:", error);
      addToast('打开文件失败: ' + error.message, 'error');
    }
  }, [comparisonsFilePath, addToast]);

  // 点击拖拽区域打开文件选择对话框
  const openFileDialog = useCallback(async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [{
          name: 'CSV Files',
          extensions: ['csv']
        }],
        defaultPath: inputDir || undefined
      });
      
      if (selected) {
        const paths = Array.isArray(selected) ? selected : [selected];
        handleFileDropRef.current?.(paths);
      }
    } catch (error) {
      console.error("Failed to open file dialog:", error);
    }
  }, [inputDir]);

  // 关闭右键菜单（点击其他地方）
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  // 等待后端就绪
  const waitForBackend = useCallback(async () => {
    const maxAttempts = 30; // 最多等待 12 秒
    
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch('http://127.0.0.1:8000/health', {
          signal: AbortSignal.timeout(400)
        });
        if (response.ok) {
          console.log('Backend is ready!');
          setBackendStatus('ready');
          addToast('后端服务已就绪', 'success');
          return true;
        }
      } catch (error) {
        // 继续重试
      }
      // 前几次快速重试，后面放慢
      const delay = i < 5 ? 200 : 400;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    console.warn('Backend failed to start in time');
    setBackendStatus('error');
    addToast('后端服务启动超时，请检查是否有其他程序占用 8000 端口', 'error');
    return false;
  }, [addToast]);

  // 初始化：等待后端就绪后加载数据
  useEffect(() => {
    const initialize = async () => {
      await waitForBackend();
      await loadConfig();
      await fetchComparisons();
      
      // 移除启动画面
      setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if (splash) {
          splash.classList.add('fade-out');
          setTimeout(() => splash.remove(), 300);
        }
      }, 100);
    };
    initialize();
  }, [waitForBackend, loadConfig, fetchComparisons]);

  // 自动保存 CDF 图表到结果文件夹
  const autoSaveChart = useCallback(async () => {
    if (!chartRef.current || !analysisResult) return;
    
    try {
      const echartsInstance = chartRef.current.getEchartsInstance();
      const imageData = echartsInstance.getDataURL({
        type: 'png',
        pixelRatio: 2, // 更高清晰度
        backgroundColor: theme === 'blackgold' ? '#000000' : (darkMode ? '#1f2937' : '#ffffff'),
        excludeComponents: ['toolbox', 'dataZoom'] // 排除工具箱和缩放滑动条
      });
      
      // 将 base64 转换为字节数组
      const base64Data = imageData.split(',')[1];
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // 自动保存到结果文件夹
      const baseName = analysisResult.base_name || 'rtt_analysis';
      const filePath = `${analysisResult.output_dir}\\${baseName}_cdf.png`;
      
      await writeFile(filePath, bytes);
      console.log(`Chart auto-saved to: ${filePath}`);
    } catch (error) {
      console.error('Failed to auto-save chart:', error);
      addToast('自动保存图表失败: ' + error.message, 'error');
    }
  }, [analysisResult, darkMode, theme, addToast]);

  // 为特定分析结果生成并保存图表（用于多文件处理）
  const saveChartForResult = useCallback(async (resultData) => {
    if (!resultData || !resultData.chart_data || !chartRef.current) return;
    
    try {
      // 短暂等待，确保 UI 已经更新并渲染了新的图表
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const echartsInstance = chartRef.current.getEchartsInstance();
      if (!echartsInstance) {
        console.warn('ECharts instance not available for saveChartForResult');
        return;
      }
      
      const imageData = echartsInstance.getDataURL({
        type: 'png',
        pixelRatio: 2,
        backgroundColor: theme === 'blackgold' ? '#000000' : (darkMode ? '#1f2937' : '#ffffff'),
        excludeComponents: ['toolbox', 'dataZoom']
      });
      
      // 将 base64 转换为字节数组
      const base64Data = imageData.split(',')[1];
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // 保存到结果文件夹
      const baseName = resultData.base_name || 'rtt_analysis';
      const filePath = `${resultData.output_dir}\\${baseName}_cdf.png`;
      
      await writeFile(filePath, bytes);
      console.log(`✓ Chart saved for ${baseName} to: ${filePath}`);
      
    } catch (error) {
      console.error(`Failed to save chart for ${resultData.base_name}:`, error);
      // 不显示错误提示，避免多个文件时弹出太多提示
    }
  }, [darkMode, theme, chartRef]);

  // 手动保存图表（用户点击按钮触发）
  const handleManualSaveChart = useCallback(async () => {
    // 根据当前激活的标签页选择对应的图表引用
    let currentChartRef = null;
    let chartType = '';
    
    if (activeTab === 'chart' && chartRef.current && analysisResult) {
      currentChartRef = chartRef.current;
      chartType = 'cdf';
    } else if (activeTab === 'trend' && trendChartRef.current && comparisonsData) {
      currentChartRef = trendChartRef.current;
      chartType = 'trend';
    }
    
    if (!currentChartRef) {
      addToast('没有可保存的图表', 'warning');
      return;
    }
    
    try {
      const echartsInstance = currentChartRef.getEchartsInstance();
      const imageData = echartsInstance.getDataURL({
        type: 'png',
        pixelRatio: 2,
        backgroundColor: theme === 'blackgold' ? '#000000' : (darkMode ? '#1f2937' : '#ffffff'),
        excludeComponents: ['toolbox', 'dataZoom']
      });
      
      // 将 base64 转换为字节数组
      const base64Data = imageData.split(',')[1];
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // 打开保存对话框
      const baseName = analysisResult?.base_name || 'rtt_analysis';
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filePath = await save({
        defaultPath: `${baseName}_${chartType}_${timestamp}.png`,
        filters: [{
          name: 'PNG 图片',
          extensions: ['png']
        }]
      });
      
      if (filePath) {
        await writeFile(filePath, bytes);
        addToast('图表已保存', 'success');
        console.log(`Chart manually saved to: ${filePath}`);
      }
    } catch (error) {
      console.error('Failed to save chart:', error);
      addToast('保存图表失败: ' + error.message, 'error');
    }
  }, [activeTab, chartRef, trendChartRef, analysisResult, comparisonsData, darkMode, theme, addToast]);

  // 监听工具栏保存图片事件
  useEffect(() => {
    const handleSaveChartEvent = () => {
      handleManualSaveChart();
    };
    
    window.addEventListener('saveChartImage', handleSaveChartEvent);
    
    return () => {
      window.removeEventListener('saveChartImage', handleSaveChartEvent);
    };
  }, [handleManualSaveChart]);

  // 监听工具栏全部显示/隐藏事件
  useEffect(() => {
    const handleToggleAllEvent = () => {
      toggleAllTrendSeries();
    };
    
    window.addEventListener('toggleAllTrendSeries', handleToggleAllEvent);
    
    return () => {
      window.removeEventListener('toggleAllTrendSeries', handleToggleAllEvent);
    };
  }, [toggleAllTrendSeries]);

  // 当图表数据更新时自动保存
  useEffect(() => {
    if (analysisResult && chartRef.current) {
      // 延迟一下确保图表已经渲染完成
      const timer = setTimeout(() => {
        autoSaveChart();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [analysisResult, autoSaveChart]);

  // --- File Drop Logic using Tauri's native event system ---
  const handleFileDrop = useCallback(async (paths) => {
    // 如果后端未就绪，忽略文件拖放
    if (backendStatus !== 'ready') {
      console.log('Backend not ready, ignoring file drop');
      return;
    }
    
    setIsProcessing(true);
    const timestamp = new Date().toLocaleString('zh-CN', { 
      month: '2-digit', 
      day: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    // 自动提取并保存输入目录（从第一个文件）
    if (paths.length > 0 && !inputDir) {
      const firstFilePath = String(paths[0] || '');
      if (firstFilePath) {
        const directory = firstFilePath.substring(0, firstFilePath.lastIndexOf('\\'));
        setInputDir(directory);
        await saveConfig(directory, outputBaseDir);
      }
    }
    
    const newFiles = paths.map(filePath => ({
      id: Date.now() + Math.random(), // 使用唯一 ID 而不是路径
      path: filePath, 
      name: filePath.split(/[\\/]/).pop(),
      status: 'queued',
      result: null,
      timestamp: timestamp, // 添加时间戳
    }));
    
    // 直接添加所有文件，允许重复
    setFiles(prevFiles => [...prevFiles, ...newFiles]);

    for (const file of newFiles) {
      try {
        setFiles(prevFiles => prevFiles.map(f => f.id === file.id ? { ...f, status: 'processing' } : f));
        
        const response = await fetch('http://127.0.0.1:8000/process-file', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            file_path: file.path,
            output_base_dir: outputBaseDir || ""  // 发送空字符串而不是 null
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
          console.error("Server error:", errorData);
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();

        setFiles(prevFiles => prevFiles.map(f => f.id === file.id ? { ...f, status: 'success', result: result.data } : f));
        setAnalysisResult(result.data);
        addToast(`成功分析文件: ${file.name}`, 'success');
        
        // 立即为当前文件保存图表
        await saveChartForResult(result.data);
        
        // 刷新 comparisons 数据
        await fetchComparisons();

      } catch (error) {
        console.error("Error processing file:", error);
        const errorMessage = error.message.includes('Failed to fetch') 
          ? '无法连接到后端服务。请确保Python服务正在运行。'
          : error.message;

        setFiles(prevFiles => prevFiles.map(f => f.id === file.id ? { ...f, status: 'error', result: errorMessage } : f));
        addToast(`处理失败: ${file.name} - ${errorMessage}`, 'error');
        setAnalysisResult(null);
      }
    }
    
    setIsProcessing(false);
  }, [fetchComparisons, inputDir, outputBaseDir, saveConfig, backendStatus, addToast, saveChartForResult]);

  // 使用 ref 保存最新的 handleFileDrop 函数
  useEffect(() => {
    handleFileDropRef.current = handleFileDrop;
  }, [handleFileDrop]);

  // Set up Tauri event listeners for file drop
   useEffect(() => {
    let unlisten;

    const setupListeners = async () => {
      console.log('=== Setting up Tauri file drop listeners (v2 method) ===');
      
      try {
        const appWindow = getCurrentWindow();
        
        unlisten = await appWindow.onDragDropEvent((event) => {
          console.log('>>> Drag drop event received <<<');
          console.log('Event:', event);
          console.log('Event payload:', event.payload);
          
          if (event.payload.type === 'hover' || event.payload.type === 'over') {
            console.log('>>> File hover detected <<<');
            setIsDragOver(true);
            
            // 检查是否在拖拽区域内（用于高亮显示）
            const dropZone = dropZoneRef.current;
            if (dropZone && event.payload.position) {
              const rect = dropZone.getBoundingClientRect();
              const scaleFactor = window.devicePixelRatio || 1;
              const logicalX = event.payload.position.x / scaleFactor;
              const logicalY = event.payload.position.y / scaleFactor;
              
              const isInside = (
                logicalX >= rect.left &&
                logicalX <= rect.right &&
                logicalY >= rect.top &&
                logicalY <= rect.bottom
              );
              
              setIsOverDropZone(isInside);
            }
          } else if (event.payload.type === 'drop') {
            console.log('>>> Files dropped <<<');
            
            // 检查是否在拖拽区域内
            const dropZone = dropZoneRef.current;
            if (dropZone && event.payload.position) {
              const rect = dropZone.getBoundingClientRect();
              
              // Tauri 返回的是 PhysicalPosition，需要转换为逻辑坐标
              const scaleFactor = window.devicePixelRatio || 1;
              const logicalX = event.payload.position.x / scaleFactor;
              const logicalY = event.payload.position.y / scaleFactor;
              
              const isInside = (
                logicalX >= rect.left &&
                logicalX <= rect.right &&
                logicalY >= rect.top &&
                logicalY <= rect.bottom
              );
              
              console.log('Physical position:', event.payload.position);
              console.log('Scale factor:', scaleFactor);
              console.log('Logical position:', { x: logicalX, y: logicalY });
              console.log('Drop zone rect:', rect);
              console.log('Is inside drop zone?', isInside);
              
              if (isInside) {
                const paths = event.payload.paths || [];
                if (paths.length) {
                  handleFileDropRef.current?.(paths);
                }
              } else {
                console.log('Drop ignored - not over drop zone');
              }
            }
            
            setIsDragOver(false);
            setIsOverDropZone(false);
          } else if (event.payload.type === 'cancel') {
            console.log('>>> Drop cancelled <<<');
            setIsDragOver(false);
            setIsOverDropZone(false);
          }
        });
        
        console.log('✓ File drop listener registered via onDragDropEvent');
        console.log('=== All listeners set up successfully ===');
      } catch (err) {
        console.error('!!! Error setting up listeners:', err);
        throw err;
      }
    };

    setupListeners().catch(err => {
      console.error('Failed to setup file drop listeners:', err);
      setLastError('Failed to initialize file drop: ' + err.message);
    });

    return () => {
      console.log('Cleaning up listeners...');
      if (unlisten) unlisten();
    };
  }, []); // 空依赖数组，避免重复注册监听器
  
  // --- Chart Options ---
  const chartOption = useMemo(() => {
    if (!analysisResult || !analysisResult.chart_data) return {};
    const stats = analysisResult.stats;
    const { x, y, x_max } = analysisResult.chart_data;
    const gold = '#C79B45';
    const goldStrong = 'rgba(199,155,69,0.9)';
    const goldMid = 'rgba(199,155,69,0.7)';
    const goldWeak = 'rgba(199,155,69,0.5)';
    
    // 计算 X 轴的合理范围：取 P99.99 或最大值的 1.1 倍
    // 使用后端计算好的 x_max，避免前端循环计算
    const xAxisMax = Math.min(stats.p9999_ms * 1.2, x_max);

    // 为5条统计线分配标签位置（上方/下方交替），根据值的大小排序
    const statLines = [
      { name: 'Mean', value: stats.mean_ms, color: '#10b981' },
      { name: 'P90', value: stats.p90_ms, color: '#f59e0b' },
      { name: 'P99', value: stats.p99_ms, color: '#ef4444' },
      { name: 'P99.9', value: stats.p999_ms, color: '#8b5cf6' },
      { name: 'P99.99', value: stats.p9999_ms, color: '#ec4899' }
    ];
    
    // 按值从小到大排序
    statLines.sort((a, b) => a.value - b.value);
    
    // 分配位置：交替上下，从最小值开始
    const labelPositions = {};
    statLines.forEach((line, index) => {
      // 偶数索引(0,2,4)放下方，奇数索引(1,3)放上方
      labelPositions[line.name] = index % 2 === 0 ? -0.05 : 1.05;
    });

    return {
      backgroundColor: 'transparent',
      textStyle: theme === 'blackgold' ? { color: gold } : undefined,
      tooltip: {
        trigger: 'axis',
        formatter: (params) => {
          if (params && params.length > 0) {
            const point = params[0];
            const rtt = point.data[0].toFixed(2);
            const cdf = (point.data[1] * 100).toFixed(2);
            return `<div style="padding: 4px;">
              <strong>RTT:</strong> ${rtt} ms<br />
              <strong>CDF:</strong> ${cdf}%
            </div>`;
          }
          return '';
        },
        backgroundColor: theme === 'blackgold' ? 'rgba(0, 0, 0, 0.95)' : (darkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)'),
        borderColor: theme === 'blackgold' ? gold : (darkMode ? '#4b5563' : '#e5e7eb'),
        borderWidth: 1,
        textStyle: {
          color: theme === 'blackgold' ? gold : (darkMode ? '#f3f4f6' : '#111827')
        },
        extraCssText: 'box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);'
      },
      // 添加图例 - 两行显示
      legend: {
        data: ['CDF 曲线', 'Mean', 'P90', 'P99', 'P99.9', 'P99.99'],
        textStyle: { color: theme === 'blackgold' ? gold : (darkMode ? '#ccc' : '#333'), fontSize: 12 },
        top: 0,
        left: 'center',
        itemWidth: 25,
        itemHeight: 14,
        itemGap: 15,
        selected: {
          'CDF 曲线': true,
          'Mean': true,
          'P90': true,
          'P99': true,
          'P99.9': true,
          'P99.99': true
        }
      },
      // 添加工具箱，包含缩放、还原、保存等功能
      toolbox: {
        feature: {
          dataZoom: {
            yAxisIndex: 'none',
            title: {
              zoom: '区域缩放',
              back: '还原缩放'
            }
          },
          restore: {
            title: '还原'
          },
          saveAsImage: {
            show: false // 隐藏默认的保存按钮，因为在 Tauri 中不工作
          },
          // 自定义保存按钮
          mySaveImage: {
            show: true,
            title: '保存为图片',
            icon: 'path://M4.7,22.9L29.3,45.5L54.7,23.9M4.6,43.6L4.6,58L53.8,58L53.8,43.6M29.2,45.1L29.2,0',
            onclick: function() {
              // 触发手动保存函数
              const event = new CustomEvent('saveChartImage');
              window.dispatchEvent(event);
            }
          }
        },
        iconStyle: {
          borderColor: theme === 'blackgold' ? gold : (darkMode ? '#9ca3af' : '#6b7280')
        },
        emphasis: {
          iconStyle: {
            borderColor: theme === 'blackgold' ? gold : (darkMode ? '#3b82f6' : '#2563eb')
          }
        }
      },
      // 添加数据区域缩放组件
      dataZoom: [
        {
          type: 'inside', // 内置型，支持鼠标滚轮缩放和拖拽平移
          xAxisIndex: [0],
          start: 0,
          end: 100,
          zoomOnMouseWheel: true, // 鼠标滚轮缩放
          moveOnMouseMove: true, // 按住鼠标移动平移
          moveOnMouseWheel: false, // Shift + 滚轮平移
          preventDefaultMouseMove: true
        },
        {
          type: 'slider', // 滑动条型，显示在图表下方
          xAxisIndex: [0],
          start: 0,
          end: 100,
          height: 18,
          bottom: 5,
          show: true, // 在界面上显示
          showDetail: false, // 不显示详细数值
          borderColor: theme === 'blackgold' ? gold : (darkMode ? '#4b5563' : '#d1d5db'),
          fillerColor: theme === 'blackgold' ? 'rgba(199, 155, 69, 0.20)' : (darkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.15)'),
          handleStyle: {
            color: theme === 'blackgold' ? gold : (darkMode ? '#3b82f6' : '#2563eb'),
            borderColor: theme === 'blackgold' ? '#b8893d' : (darkMode ? '#60a5fa' : '#3b82f6')
          },
          textStyle: {
            color: theme === 'blackgold' ? gold : (darkMode ? '#9ca3af' : '#6b7280')
          },
          // 关键：保存图片时不包含滑动条
          emphasis: {
            handleStyle: {
              shadowBlur: 3,
              shadowColor: theme === 'blackgold' ? 'rgba(199, 155, 69, 0.4)' : (darkMode ? 'rgba(59, 130, 246, 0.4)' : 'rgba(37, 99, 235, 0.4)')
            }
          }
        },
        {
          type: 'inside', // Y轴也支持缩放
          yAxisIndex: [0],
          start: 0,
          end: 100,
          zoomOnMouseWheel: false,
          moveOnMouseMove: false,
          moveOnMouseWheel: false
        }
      ],
      xAxis: {
        type: 'value',
        name: 'RTT (ms)',
        nameLocation: 'middle', // 标签位置在中间
        nameTextStyle: { color: theme === 'blackgold' ? gold : (darkMode ? '#ccc' : '#333'), fontSize: 12 },
        nameGap: 25, // 标签与轴线的距离
        axisLine: { lineStyle: { color: theme === 'blackgold' ? gold : (darkMode ? '#ccc' : '#333') } },
        splitLine: theme === 'blackgold' ? { show: true, lineStyle: { color: 'rgba(199,155,69,0.12)' } } : undefined,
        max: xAxisMax, // 设置最大值为合理范围
        axisLabel: {
          color: theme === 'blackgold' ? gold : (darkMode ? '#9ca3af' : '#6b7280')
        }
      },
      yAxis: {
        type: 'value',
        name: 'CDF',
        nameLocation: 'middle', // 标签位置在中间
        nameTextStyle: { color: theme === 'blackgold' ? gold : (darkMode ? '#ccc' : '#333'), fontSize: 12 },
        nameGap: 35, // 标签与轴线的距离
        axisLine: { lineStyle: { color: theme === 'blackgold' ? gold : (darkMode ? '#ccc' : '#333') } },
        min: -0.1, // 扩展范围，为下方标签留出空间
        max: 1.1, // 扩展范围，为上方标签留出空间
        splitLine: theme === 'blackgold' ? { show: true, lineStyle: { color: 'rgba(199,155,69,0.12)' } } : undefined,
        axisLabel: {
          formatter: (value) => {
            // 只显示0-100%的标签
            if (value < 0 || value > 1) return '';
            return (value * 100).toFixed(0) + '%';
          },
          color: theme === 'blackgold' ? gold : (darkMode ? '#9ca3af' : '#6b7280')
        }
      },
      series: [
        {
          name: 'CDF 曲线',
          data: y.map((val, index) => [x[index], val]),
          type: 'line',
          smooth: true,
          showSymbol: false,
          lineStyle: {
            color: theme === 'blackgold' ? gold : '#3b82f6',
            width: 2.2,
          },
          itemStyle: {
            color: theme === 'blackgold' ? gold : '#3b82f6'
          },
        },
        // Mean 线 - 使用两个点创建垂直线
        {
          name: 'Mean',
          type: 'line',
          data: [[stats.mean_ms, 0], [stats.mean_ms, 1]],
          showSymbol: false,
          lineStyle: {
            type: 'dashed',
            width: 2,
            color: theme === 'blackgold' ? goldStrong : '#10b981'
          },
          itemStyle: {
            color: theme === 'blackgold' ? goldStrong : '#10b981'
          },
          markPoint: {
            symbol: 'rect',
            symbolSize: [1, 1],
            label: {
              show: true,
              formatter: `Mean\n${stats.mean_ms.toFixed(2)}ms`,
              fontSize: 11,
              color: theme === 'blackgold' ? gold : (darkMode ? '#000' : '#000'),
              fontWeight: 'bold',
              backgroundColor: theme === 'blackgold' ? 'rgba(0,0,0,0.9)' : 'rgba(255, 255, 255, 0.9)',
              padding: [3, 6],
              borderRadius: 3,
              borderColor: theme === 'blackgold' ? gold : undefined,
              borderWidth: theme === 'blackgold' ? 1 : 0
            },
            data: [{ coord: [stats.mean_ms, labelPositions['Mean']] }]
          }
        },
        // P90 线
        {
          name: 'P90',
          type: 'line',
          data: [[stats.p90_ms, 0], [stats.p90_ms, 1]],
          showSymbol: false,
          lineStyle: {
            type: 'dashed',
            width: 2,
            color: theme === 'blackgold' ? goldMid : '#f59e0b'
          },
          itemStyle: {
            color: theme === 'blackgold' ? goldMid : '#f59e0b'
          },
          markPoint: {
            symbol: 'rect',
            symbolSize: [1, 1],
            label: {
              show: true,
              formatter: `P90\n${stats.p90_ms.toFixed(2)}ms`,
              fontSize: 11,
              color: theme === 'blackgold' ? gold : (darkMode ? '#000' : '#000'),
              fontWeight: 'bold',
              backgroundColor: theme === 'blackgold' ? 'rgba(0,0,0,0.9)' : 'rgba(255, 255, 255, 0.9)',
              padding: [3, 6],
              borderRadius: 3,
              borderColor: theme === 'blackgold' ? gold : undefined,
              borderWidth: theme === 'blackgold' ? 1 : 0
            },
            data: [{ coord: [stats.p90_ms, labelPositions['P90']] }]
          }
        },
        // P99 线
        {
          name: 'P99',
          type: 'line',
          data: [[stats.p99_ms, 0], [stats.p99_ms, 1]],
          showSymbol: false,
          lineStyle: {
            type: 'dashed',
            width: 2,
            color: theme === 'blackgold' ? 'rgba(199,155,69,0.55)' : '#8b5cf6'
          },
          itemStyle: {
            color: theme === 'blackgold' ? 'rgba(199,155,69,0.55)' : '#8b5cf6'
          },
          markPoint: {
            symbol: 'rect',
            symbolSize: [1, 1],
            label: {
              show: true,
              formatter: `P99\n${stats.p99_ms.toFixed(2)}ms`,
              fontSize: 11,
              color: theme === 'blackgold' ? gold : (darkMode ? '#000' : '#000'),
              fontWeight: 'bold',
              backgroundColor: theme === 'blackgold' ? 'rgba(0,0,0,0.9)' : 'rgba(255, 255, 255, 0.9)',
              padding: [3, 6],
              borderRadius: 3,
              borderColor: theme === 'blackgold' ? gold : undefined,
              borderWidth: theme === 'blackgold' ? 1 : 0
            },
            data: [{ coord: [stats.p99_ms, labelPositions['P99']] }]
          }
        },
        // P99.9 线
        {
          name: 'P99.9',
          type: 'line',
          data: [[stats.p999_ms, 0], [stats.p999_ms, 1]],
          showSymbol: false,
          lineStyle: {
            type: 'dashed',
            width: 2,
            color: theme === 'blackgold' ? 'rgba(199,155,69,0.45)' : '#ec4899'
          },
          itemStyle: {
            color: theme === 'blackgold' ? 'rgba(199,155,69,0.45)' : '#ec4899'
          },
          markPoint: {
            symbol: 'rect',
            symbolSize: [1, 1],
            label: {
              show: true,
              formatter: `P99.9\n${stats.p999_ms.toFixed(2)}ms`,
              fontSize: 11,
              color: theme === 'blackgold' ? gold : (darkMode ? '#000' : '#000'),
              fontWeight: 'bold',
              backgroundColor: theme === 'blackgold' ? 'rgba(0,0,0,0.9)' : 'rgba(255, 255, 255, 0.9)',
              padding: [3, 6],
              borderRadius: 3,
              borderColor: theme === 'blackgold' ? gold : undefined,
              borderWidth: theme === 'blackgold' ? 1 : 0
            },
            data: [{ coord: [stats.p999_ms, labelPositions['P99.9']] }]
          }
        },
        // P99.99 线
        {
          name: 'P99.99',
          type: 'line',
          data: [[stats.p9999_ms, 0], [stats.p9999_ms, 1]],
          showSymbol: false,
          lineStyle: {
            type: 'dashed',
            width: 2,
            color: theme === 'blackgold' ? 'rgba(199,155,69,0.3)' : '#dc2626'
          },
          itemStyle: {
            color: theme === 'blackgold' ? 'rgba(199,155,69,0.3)' : '#dc2626'
          },
          markPoint: {
            symbol: 'rect',
            symbolSize: [1, 1],
            label: {
              show: true,
              formatter: `P99.99\n${stats.p9999_ms.toFixed(2)}ms`,
              fontSize: 11,
              color: theme === 'blackgold' ? gold : (darkMode ? '#000' : '#000'),
              fontWeight: 'bold',
              backgroundColor: theme === 'blackgold' ? 'rgba(0,0,0,0.9)' : 'rgba(255, 255, 255, 0.9)',
              padding: [3, 6],
              borderRadius: 3,
              borderColor: theme === 'blackgold' ? gold : undefined,
              borderWidth: theme === 'blackgold' ? 1 : 0
            },
            data: [{ coord: [stats.p9999_ms, labelPositions['P99.99']] }]
          }
        }
      ],
      grid: {
        left: '5%',
        right: '8%',
        bottom: '10%', // 进一步减少底部空间，滑动条更靠近图表
        top: '8%', // 进一步减少顶部空间，图例更靠近图表
        containLabel: true,
      },
    };
  }, [analysisResult, darkMode, theme]);

  // --- Trend Chart Options ---
  const trendChartOption = useMemo(() => {
    if (!comparisonsData || !comparisonsData.all_rows || comparisonsData.all_rows.length === 0) return {};

    const allRows = comparisonsData.all_rows;
    const gold = '#C79B45';
    
    // 智能处理文件名显示
    const xData = allRows.map(row => {
      // 确保 fileName 始终是字符串
      let fileName = String(row.source_file || '未命名');
      
      // 去掉 .csv 扩展名（如果有）
      if (fileName.endsWith('.csv')) {
        fileName = fileName.slice(0, -4);
      }
      
      // 如果文件名超过 18 字符，保留开头和结尾的关键信息
      if (fileName.length > 18) {
        // 策略：保留前 8 字符 + ... + 后 8 字符
        // 这样可以同时看到文件名的开头和结尾，区分度更高
        return fileName.substring(0, 8) + '...' + fileName.substring(fileName.length - 8);
      }
      
      return fileName;
    });

    return {
      backgroundColor: 'transparent',
      textStyle: theme === 'blackgold' ? { color: gold } : undefined,
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          crossStyle: {
            color: theme === 'blackgold' ? gold : (darkMode ? '#9ca3af' : '#6b7280')
          }
        },
        backgroundColor: theme === 'blackgold' ? 'rgba(0, 0, 0, 0.95)' : (darkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)'),
        borderColor: theme === 'blackgold' ? gold : (darkMode ? '#4b5563' : '#e5e7eb'),
        borderWidth: 1,
        textStyle: {
          color: theme === 'blackgold' ? gold : (darkMode ? '#f3f4f6' : '#111827')
        },
        extraCssText: 'box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);',
        // 在 tooltip 中显示完整文件名
        formatter: function(params) {
          const sourceFile = String(allRows[params[0].dataIndex].source_file || '未命名');
          let result = `<div style="font-weight: bold; margin-bottom: 4px;">${sourceFile}</div>`;
          params.forEach(param => {
            result += `<div style="display: flex; align-items: center; gap: 8px;">
              <span style="display: inline-block; width: 10px; height: 10px; background-color: ${param.color}; border-radius: 50%;"></span>
              <span>${param.seriesName}: <strong>${param.value.toFixed(2)} ms</strong></span>
            </div>`;
          });
          return result;
        }
      },
      // 添加工具箱
      toolbox: {
        feature: {
          dataZoom: {
            yAxisIndex: 'none',
            title: {
              zoom: '区域缩放',
              back: '还原缩放'
            }
          },
          restore: {
            title: '还原'
          },
          saveAsImage: {
            show: false // 隐藏默认的保存按钮
          },
          // 自定义保存按钮
          mySaveImage: {
            show: true,
            title: '保存为图片',
            icon: 'path://M4.7,22.9L29.3,45.5L54.7,23.9M4.6,43.6L4.6,58L53.8,58L53.8,43.6M29.2,45.1L29.2,0',
            onclick: function() {
              // 触发手动保存函数
              const event = new CustomEvent('saveChartImage');
              window.dispatchEvent(event);
            }
          },
          // 全部显示/隐藏按钮（根据状态显示不同图标）
          myToggleAll: {
            show: true,
            title: allTrendSeriesVisible ? '全部隐藏' : '全部显示',
            // 根据状态切换图标：完整眼睛 vs 划线眼睛
            icon: allTrendSeriesVisible 
              ? 'path://M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z'
              : 'path://M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z',
            onclick: function() {
              // 触发全部显示/隐藏事件
              const event = new CustomEvent('toggleAllTrendSeries');
              window.dispatchEvent(event);
            }
          }
        },
        iconStyle: {
          borderColor: theme === 'blackgold' ? gold : (darkMode ? '#9ca3af' : '#6b7280')
        },
        emphasis: {
          iconStyle: {
            borderColor: theme === 'blackgold' ? gold : (darkMode ? '#3b82f6' : '#2563eb')
          }
        }
      },
      // 添加数据区域缩放
      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: [0],
          start: 0,
          end: 100,
          zoomOnMouseWheel: true,
          moveOnMouseMove: true,
          moveOnMouseWheel: false
        },
        {
          type: 'slider',
          xAxisIndex: [0],
          start: 0,
          end: 100,
          height: 18,
          bottom: 2,
          show: true,
          showDetail: false,
          borderColor: theme === 'blackgold' ? gold : (darkMode ? '#4b5563' : '#d1d5db'),
          fillerColor: theme === 'blackgold' ? 'rgba(199, 155, 69, 0.2)' : (darkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.15)'),
          handleStyle: {
            color: theme === 'blackgold' ? gold : (darkMode ? '#3b82f6' : '#2563eb'),
            borderColor: theme === 'blackgold' ? '#b8893d' : (darkMode ? '#60a5fa' : '#3b82f6')
          },
          textStyle: {
            color: theme === 'blackgold' ? gold : (darkMode ? '#9ca3af' : '#6b7280')
          },
          emphasis: {
            handleStyle: {
              shadowBlur: 3,
              shadowColor: theme === 'blackgold' ? 'rgba(199, 155, 69, 0.4)' : (darkMode ? 'rgba(59, 130, 246, 0.4)' : 'rgba(37, 99, 235, 0.4)')
            }
          }
        },
        {
          type: 'inside',
          yAxisIndex: [0],
          start: 0,
          end: 100,
          zoomOnMouseWheel: false,
          moveOnMouseMove: false
        }
      ],
      legend: {
        data: ['Mean', 'P90', 'P99', 'P99.9', 'P99.99'],
        textStyle: { color: theme === 'blackgold' ? gold : (darkMode ? '#ccc' : '#333') },
        top: 5
      },
      xAxis: {
        type: 'category',
        data: xData,
        name: '文件名',
        nameLocation: 'middle',
        nameTextStyle: { color: theme === 'blackgold' ? gold : (darkMode ? '#ccc' : '#333'), fontSize: 12 },
        nameGap: 30,
        axisLine: { lineStyle: { color: theme === 'blackgold' ? gold : (darkMode ? '#ccc' : '#333') } },
        splitLine: theme === 'blackgold' ? { show: false } : undefined,
        axisLabel: {
          color: theme === 'blackgold' ? gold : (darkMode ? '#9ca3af' : '#6b7280'),
          fontSize: 11,
          interval: 0, // 显示所有标签
          overflow: 'truncate', // 超出部分截断
          width: 80, // 标签最大宽度
          ellipsis: '...' // 截断时显示省略号
        }
      },
      yAxis: {
        type: 'value',
        name: 'RTT (ms)',
        nameLocation: 'middle', // 标签位置在中间
        nameTextStyle: { color: theme === 'blackgold' ? gold : (darkMode ? '#ccc' : '#333'), fontSize: 12 },
        nameGap: 35, // 标签与轴线的距离
        axisLine: { lineStyle: { color: theme === 'blackgold' ? gold : (darkMode ? '#ccc' : '#333') } },
        splitLine: theme === 'blackgold' ? { show: true, lineStyle: { color: 'rgba(199,155,69,0.12)' } } : undefined,
        axisLabel: {
          color: theme === 'blackgold' ? gold : (darkMode ? '#9ca3af' : '#6b7280')
        }
      },
      series: [
        {
          name: 'Mean',
          type: 'line',
          data: allRows.map(row => row.mean_ms),
          smooth: true,
          lineStyle: { color: theme === 'blackgold' ? 'rgba(199,155,69,0.9)' : '#10b981', width: 2 },
          itemStyle: { color: theme === 'blackgold' ? gold : '#10b981' },
          endLabel: {
            show: true,
            formatter: '{a}',
            color: theme === 'blackgold' ? gold : '#10b981',
            fontSize: 12,
            fontWeight: 'bold',
            distance: 10
          }
        },
        {
          name: 'P90',
          type: 'line',
          data: allRows.map(row => row.p90_ms),
          smooth: true,
          lineStyle: { color: theme === 'blackgold' ? 'rgba(199,155,69,0.75)' : '#f59e0b', width: 2 },
          itemStyle: { color: theme === 'blackgold' ? gold : '#f59e0b' },
          endLabel: {
            show: true,
            formatter: '{a}',
            color: theme === 'blackgold' ? gold : '#f59e0b',
            fontSize: 12,
            fontWeight: 'bold',
            distance: 10
          }
        },
        {
          name: 'P99',
          type: 'line',
          data: allRows.map(row => row.p99_ms),
          smooth: true,
          lineStyle: { color: theme === 'blackgold' ? 'rgba(199,155,69,0.55)' : '#8b5cf6', width: 2 },
          itemStyle: { color: theme === 'blackgold' ? gold : '#8b5cf6' },
          endLabel: {
            show: true,
            formatter: '{a}',
            color: theme === 'blackgold' ? gold : '#8b5cf6',
            fontSize: 12,
            fontWeight: 'bold',
            distance: 10
          }
        },
        {
          name: 'P99.9',
          type: 'line',
          data: allRows.map(row => row.p999_ms),
          smooth: true,
          lineStyle: { color: theme === 'blackgold' ? 'rgba(199,155,69,0.45)' : '#ec4899', width: 2 },
          itemStyle: { color: theme === 'blackgold' ? gold : '#ec4899' },
          endLabel: {
            show: true,
            formatter: '{a}',
            color: theme === 'blackgold' ? gold : '#ec4899',
            fontSize: 12,
            fontWeight: 'bold',
            distance: 10
          }
        },
        {
          name: 'P99.99',
          type: 'line',
          data: allRows.map(row => row.p9999_ms),
          smooth: true,
          lineStyle: { color: theme === 'blackgold' ? 'rgba(199,155,69,0.3)' : '#dc2626', width: 2 },
          itemStyle: { color: theme === 'blackgold' ? gold : '#dc2626' },
          endLabel: {
            show: true,
            formatter: '{a}',
            color: theme === 'blackgold' ? gold : '#dc2626',
            fontSize: 12,
            fontWeight: 'bold',
            distance: 10
          }
        }
      ],
      grid: {
        left: '5%',
        right: '8%', // 增加右侧空间，为端点标签留出显示空间
        bottom: '12%', // 适中的底部空间
        top: '10%',
        containLabel: true
      }
    };
  }, [comparisonsData, darkMode, allTrendSeriesVisible, theme]);
  
  // --- UI Rendering ---
  return (
    <div className={`min-h-screen p-4 md:p-6 transition-colors duration-500 font-sans ${
      theme === 'blackgold'
        ? 'theme-blackgold bg-gradient-to-br from-black via-neutral-950 to-stone-950 text-amber-500/80'
        : 'bg-gradient-mesh bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100'
    }`}>
      {/* Toast通知容器 */}
      <ToastContainer toasts={toasts} removeToast={removeToast} theme={theme} />
      
      <div className="max-w-7xl mx-auto">
        <header className="flex justify-between items-center mb-4 md:mb-6">
          <div>
            <h1 className={`text-2xl md:text-3xl font-bold bg-clip-text text-transparent ${
              theme === 'blackgold'
                ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 drop-shadow-[0_0_12px_rgba(251,191,36,0.4)]'
                : 'bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400'
            }`}>
              RTT Analyzer
            </h1>
            <p className={`text-xs md:text-sm mt-0.5 ${
              theme === 'blackgold'
                ? 'text-amber-700/50'
                : 'text-gray-500 dark:text-gray-400'
            }`}>
              RTT数据统计分析与可视化平台
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* 后端状态指示器 */}
            {backendStatus === 'connecting' && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                theme === 'blackgold'
                  ? 'bg-gold/10 text-gold border border-gold/20'
                  : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
              }`}>
                <div className={`inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 ${
                  theme === 'blackgold' ? 'border-gold' : 'border-yellow-600 dark:border-yellow-400'
                }`}></div>
                <span>连接中</span>
              </div>
            )}
            {backendStatus === 'ready' && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                theme === 'blackgold'
                  ? 'bg-gold/10 text-gold border border-gold/20'
                  : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
              }`}>
                <div className={`inline-block rounded-full h-2 w-2 animate-pulse ${
                  theme === 'blackgold' ? 'bg-gold' : 'bg-green-600 dark:bg-green-400'
                }`}></div>
                <span>已就绪</span>
              </div>
            )}
            {backendStatus === 'error' && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                theme === 'blackgold'
                  ? 'bg-gold/10 text-gold/80 border border-gold/20'
                  : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
              }`}>
                <AlertTriangle size={16} />
                <span>连接失败</span>
              </div>
            )}
            {/* 主题切换按钮组 */}
            <div className="flex items-center gap-2">
              {/* 主题选择器 */}
              <div className={`flex items-center gap-1 p-1 rounded-full shadow-md ${
                theme === 'blackgold' 
                  ? 'bg-black border border-amber-600/20' 
                  : 'bg-white dark:bg-gray-800'
              }`}>
                <button
                  onClick={() => {
                    console.log('🎨 切换到炫彩主题');
                    setTheme('colorful');
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${
                    theme === 'colorful'
                      ? 'bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 text-white shadow-md'
                      : theme === 'blackgold'
                      ? 'text-amber-700/40 hover:bg-zinc-900/50'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  title="炫彩主题"
                >
                  炫彩
                </button>
                <button
                  onClick={() => {
                    console.log('🎨 切换到黑金主题');
                    setTheme('blackgold');
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${
                    theme === 'blackgold'
                      ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-amber-950 font-bold shadow-md shadow-amber-600/40 border border-amber-400/50'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  title="黑金主题 - 低调奢华"
                >
                  黑金
                </button>
              </div>
              
              {/* 暗黑模式切换 */}
              <button 
                onClick={toggleDarkMode}
                className={`p-2.5 rounded-full transition-all duration-200 shadow-md motion-safe:transform hover:-translate-y-0.5 active:translate-y-0 hover:shadow-lg focus:outline-none focus:ring-2 ${
                  theme === 'blackgold'
                    ? 'bg-black border border-amber-600/20 hover:bg-zinc-900/80 focus:ring-amber-600/40'
                    : 'bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 focus:ring-blue-400/60'
                }`}
              >
                {darkMode ? (
                  <Sun size={20} className={theme === 'blackgold' ? 'text-amber-600/70' : 'text-yellow-500'} />
                ) : (
                  <Moon size={20} className={theme === 'blackgold' ? 'text-amber-600/60' : 'text-indigo-600'} />
                )}
              </button>
            </div>
          </div>
        </header>
        
        <main className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
          {/* Left Column */}
          <div className="lg:col-span-1 flex flex-col gap-2 md:gap-3">
            {/* 目录配置 */}
            <Card theme={theme}>
              <h2 className={`text-lg md:text-xl font-semibold mb-3 flex items-center ${
                theme === 'blackgold' ? 'text-gold' : ''
              }`}>
                <FolderOpen size={18} className={`mr-2 ${theme === 'blackgold' ? 'text-gold' : ''}`}/>
                目录配置
              </h2>
              
              {/* 输入文件根目录 */}
              <div className="mb-3">
                <label className={`block text-xs md:text-sm font-medium mb-1.5 ${
                  theme === 'blackgold' ? 'text-gold' : 'text-gray-700 dark:text-gray-300'
                }`}>
                  输入文件目录
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputDir}
                    onChange={(e) => setInputDir(e.target.value)}
                    onBlur={() => saveConfig(inputDir, outputBaseDir)}
                    placeholder="选择输入文件所在目录"
                    className={`flex-1 px-3 py-2 rounded-lg text-xs md:text-sm focus:outline-none focus:ring-2 transition-all ${
                      theme === 'blackgold'
                        ? 'border border-gold/20 bg-black/60 text-gold placeholder-gold/30 focus:ring-gold/40 focus:border-gold/60'
                        : 'border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-blue-500/50 focus:border-blue-500'
                    }`}
                  />
                  <button
                    onClick={selectInputDir}
                    className={`px-3 py-2 rounded-lg transition-all duration-200 hover:shadow-lg active:scale-95 focus:outline-none focus:ring-2 ${
                      theme === 'blackgold'
                        ? 'bg-gradient-to-r from-gold/90 via-gold/80 to-gold/90 text-black hover:from-gold hover:to-gold hover:shadow-gold/60 focus:ring-gold/40'
                        : 'bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-700 hover:to-blue-600 focus:ring-blue-500/60'
                    }`}
                    title="选择文件夹"
                  >
                    <FolderOpen size={16} />
                  </button>
                  <button
                    onClick={openInputDir}
                    disabled={!inputDir}
                    className={`px-3 py-2 rounded-lg transition-all duration-200 active:scale-95 focus:outline-none focus:ring-2 ${
                      inputDir 
                        ? theme === 'blackgold'
                          ? 'bg-gradient-to-r from-gold/70 via-gold/60 to-gold/70 text-black hover:from-gold/85 hover:to-gold/85 hover:shadow-lg hover:shadow-gold/50 focus:ring-gold/40'
                          : 'bg-gradient-to-r from-pink-600 to-fuchsia-500 text-white hover:from-pink-700 hover:to-fuchsia-600 hover:shadow-lg focus:ring-pink-500/60'
                        : theme === 'blackgold'
                        ? 'bg-zinc-950/60 text-gold/20 cursor-not-allowed border border-gold/10'
                        : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-500 cursor-not-allowed'
                    }`}
                    title="打开当前文件夹"
                  >
                    <FolderSearch size={16} />
                  </button>
                </div>
                <p className={`text-xs mt-1 flex items-center gap-1 ${
                  theme === 'blackgold' ? 'text-amber-700/40' : 'text-gray-500 dark:text-gray-400'
                }`}>
                  <span className={`inline-block w-1 h-1 rounded-full ${
                    theme === 'blackgold' ? 'bg-amber-600/40' : 'bg-gray-400'
                  }`}></span>
                  拖入文件时会自动配置此目录
                </p>
              </div>
              
              {/* 输出结果文件夹根目录 */}
              <div>
                <label className={`block text-xs md:text-sm font-medium mb-1.5 ${
                  theme === 'blackgold' ? 'text-gold' : 'text-gray-700 dark:text-gray-300'
                }`}>
                  输出结果目录
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={outputBaseDir}
                    onChange={(e) => setOutputBaseDir(e.target.value)}
                    onBlur={() => saveConfig(inputDir, outputBaseDir)}
                    placeholder="选择输出结果根目录（可选）"
                    className={`flex-1 px-3 py-2 rounded-lg text-xs md:text-sm focus:outline-none focus:ring-2 transition-all ${
                      theme === 'blackgold'
                        ? 'border border-gold/20 bg-black/60 text-gold placeholder-gold/30 focus:ring-gold/40 focus:border-gold/60'
                        : 'border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-blue-500/50 focus:border-blue-500'
                    }`}
                  />
                  <button
                    onClick={selectOutputBaseDir}
                    className={`px-3 py-2 rounded-lg transition-all duration-200 hover:shadow-lg active:scale-95 focus:outline-none focus:ring-2 ${
                      theme === 'blackgold'
                        ? 'bg-gradient-to-r from-gold/90 via-gold/80 to-gold/90 text-black hover:from-gold hover:to-gold hover:shadow-gold/60 focus:ring-gold/40'
                        : 'bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-700 hover:to-blue-600 focus:ring-blue-500/60'
                    }`}
                    title="选择文件夹"
                  >
                    <FolderOpen size={16} />
                  </button>
                  <button
                    onClick={openOutputBaseDir}
                    disabled={!outputBaseDir}
                    className={`px-3 py-2 rounded-lg transition-all duration-200 active:scale-95 focus:outline-none focus:ring-2 ${
                      outputBaseDir 
                        ? theme === 'blackgold'
                          ? 'bg-gradient-to-r from-gold/70 via-gold/60 to-gold/70 text-black hover:from-gold/85 hover:to-gold/85 hover:shadow-lg hover:shadow-gold/50 focus:ring-gold/40'
                          : 'bg-gradient-to-r from-pink-600 to-fuchsia-500 text-white hover:from-pink-700 hover:to-fuchsia-600 hover:shadow-lg focus:ring-pink-500/60'
                        : theme === 'blackgold'
                        ? 'bg-zinc-950/60 text-gold/20 cursor-not-allowed border border-gold/10'
                        : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-500 cursor-not-allowed'
                    }`}
                    title="打开当前文件夹"
                  >
                    <FolderSearch size={16} />
                  </button>
                </div>
                <p className={`text-xs mt-1 flex items-center gap-1 ${
                  theme === 'blackgold' ? 'text-amber-700/40' : 'text-gray-500 dark:text-gray-400'
                }`}>
                  <span className={`inline-block w-1 h-1 rounded-full ${
                    theme === 'blackgold' ? 'bg-amber-600/40' : 'bg-gray-400'
                  }`}></span>
                  未配置时，结果将保存在输入文件所在目录
                </p>
              </div>
            </Card>
            
            <div 
              ref={dropZoneRef}
              onClick={backendStatus === 'ready' ? openFileDialog : undefined}
              className={`group relative flex flex-col items-center justify-center border-2 border-dashed h-48 md:h-56 transition-all duration-300 ease-out motion-safe:transform rounded-xl ${
                theme === 'blackgold'
                  ? backendStatus !== 'ready'
                    ? 'opacity-50 cursor-not-allowed border-amber-900/20 bg-gradient-to-br from-neutral-950 via-stone-950 to-black'
                    : `cursor-pointer ${isDragOver && isOverDropZone 
                        ? 'border-amber-500/60 bg-gradient-to-br from-amber-950/30 to-amber-900/20 scale-[1.02] ring-4 ring-amber-600/20 shadow-2xl shadow-amber-900/30' 
                        : 'border-amber-800/30 bg-gradient-to-br from-neutral-950 via-stone-950 to-black hover:border-amber-600/50 hover:from-amber-950/20 hover:to-transparent hover:scale-[1.01] hover:shadow-xl hover:shadow-amber-900/20'}`
                  : backendStatus !== 'ready' 
                    ? 'opacity-50 cursor-not-allowed border-gray-300 dark:border-gray-600 glass-card shadow-xl' 
                    : `cursor-pointer glass-card shadow-xl ${isDragOver && isOverDropZone 
                        ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/50 dark:to-cyan-900/50 scale-[1.02] ring-4 ring-blue-300/30 shadow-2xl' 
                        : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gradient-to-br hover:from-blue-50/50 hover:to-transparent dark:hover:from-blue-900/20 dark:hover:to-transparent hover:scale-[1.01] hover:shadow-xl'}`
              }`}
            >
              {/* 背景图层 (非拖拽时显示) */}
              {!(isDragOver && isOverDropZone) && (
                <img
                  src="/background.png"
                  alt="背景"
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    opacity: theme === 'blackgold' ? 0.15 : 0.25,
                    borderRadius: '1rem',
                    pointerEvents: 'none',
                    zIndex: 0
                  }}
                />
              )}
              
              {/* 文字层 */}
              <div className="relative z-10 flex flex-col items-center w-full">
                <div className={`mb-3 p-3 rounded-full transition-all duration-300 ${
                  theme === 'blackgold'
                    ? isDragOver && isOverDropZone 
                      ? 'bg-gradient-to-br from-amber-600 to-amber-500 shadow-lg shadow-amber-600/40 scale-110' 
                      : 'bg-gradient-to-br from-amber-900/40 to-amber-800/30 group-hover:from-amber-700/60 group-hover:to-amber-600/50 group-hover:scale-105 group-hover:shadow-amber-800/40'
                    : isDragOver && isOverDropZone 
                      ? 'bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg scale-110' 
                      : 'bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 group-hover:from-blue-400 group-hover:to-cyan-400 group-hover:scale-105'
                }`}>
                  <UploadCloud 
                    size={40} 
                    className={`transition-colors duration-300 ${
                      theme === 'blackgold'
                        ? isDragOver && isOverDropZone 
                          ? 'text-amber-950' 
                          : 'text-amber-600/60 group-hover:text-amber-500/80'
                        : isDragOver && isOverDropZone 
                          ? 'text-white' 
                          : 'text-gray-500 dark:text-gray-400 group-hover:text-white'
                    }`} 
                  />
                </div>
                <p className={`text-base md:text-lg font-semibold mb-1 ${
                  theme === 'blackgold' ? 'text-amber-500/80' : ''
                }`}>
                  {backendStatus === 'ready' ? (
                    isDragOver && isOverDropZone ? '松开鼠标即可上传' : '拖拽文件到此区域'
                  ) : '等待后端就绪...'}
                </p>
                <p className={`text-xs md:text-sm ${
                  theme === 'blackgold' ? 'text-amber-700/50' : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {backendStatus === 'ready' ? '或点击选择文件' : '正在启动后端服务'}
                </p>
                <p className={`text-xs mt-1.5 ${
                  theme === 'blackgold' ? 'text-amber-800/40' : 'text-gray-400 dark:text-gray-500'
                }`}>
                  {backendStatus === 'ready' ? '支持一个或多个 .csv 文件' : '请稍候...'}
                </p>
                {isProcessing && (
                  <div className={`mt-3 flex items-center gap-2 text-xs md:text-sm ${
                    theme === 'blackgold' ? 'text-amber-500' : 'text-blue-600 dark:text-blue-400'
                  }`}>
                    <div className={`inline-block animate-spin rounded-full h-3 w-3 border-t-2 border-b-2 ${
                      theme === 'blackgold' ? 'border-amber-500' : 'border-blue-600 dark:border-blue-400'
                    }`}></div>
                    <span className="font-medium">处理中...</span>
                  </div>
                )}
              </div>
              
              {/* 前景图层 (拖拽时显示，覆盖在文字上方) */}
              {isDragOver && isOverDropZone && (
                <img
                  src="/front.png"
                  alt="前景"
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    opacity: theme === 'blackgold' ? 0.4 : 0.6,
                    borderRadius: '1rem',
                    pointerEvents: 'none',
                    zIndex: 20
                  }}
                />
              )}
            </div>
            
            <Card theme={theme}>
              <h2 className={`text-lg md:text-xl font-semibold mb-3 flex items-center ${
                theme === 'blackgold' ? 'text-gold' : ''
              }`}>
                <div className={`p-1.5 rounded-lg mr-2 ${
                  theme === 'blackgold' 
                    ? 'bg-gradient-to-br from-gold to-[#b8893d]' 
                    : 'bg-gradient-to-br from-blue-500 to-cyan-500'
                }`}>
                  <File size={16} className={theme === 'blackgold' ? 'text-black' : 'text-white'}/>
                </div>
                处理队列
                {files.length > 0 && (
                  <span className={`ml-2 px-2 py-0.5 text-xs rounded-full font-bold ${
                    theme === 'blackgold'
                      ? 'bg-gold/20 text-gold border border-gold/30'
                      : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                  }`}>
                    {files.length}
                  </span>
                )}
              </h2>
              {files.length > 0 ? (
                <div className="max-h-48 md:max-h-56 overflow-y-auto pr-1 space-y-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                  {files.map(file => {
                    const statusConfig = theme === 'blackgold' ? {
                      queued: { bg: 'bg-zinc-950/60', border: 'border-gold/20', text: 'text-gold/60', label: '等待中', nameTxt: 'text-gold/70', timeTxt: 'text-gold/40' },
                      processing: { bg: 'bg-gold/10', border: 'border-gold/30', text: 'text-gold', label: '处理中', nameTxt: 'text-gold/90', timeTxt: 'text-gold/60' },
                      success: { bg: 'bg-gold/10', border: 'border-gold/30', text: 'text-gold', label: '成功', nameTxt: 'text-gold/90', timeTxt: 'text-gold/60' },
                      error: { bg: 'bg-gold/5', border: 'border-gold/20', text: 'text-gold/70', label: '失败', nameTxt: 'text-gold/70', timeTxt: 'text-gold/50' },
                    } : {
                      queued: { bg: 'bg-gray-100 dark:bg-gray-800', border: 'border-gray-200 dark:border-gray-700', text: 'text-gray-600 dark:text-gray-400', label: '等待中', nameTxt: 'text-gray-900 dark:text-gray-100', timeTxt: 'text-gray-500 dark:text-gray-400' },
                      processing: { bg: 'bg-blue-100 dark:bg-blue-900/30', border: 'border-gray-200 dark:border-gray-700', text: 'text-blue-600 dark:text-blue-400', label: '处理中', nameTxt: 'text-gray-900 dark:text-gray-100', timeTxt: 'text-gray-500 dark:text-gray-400' },
                      success: { bg: 'bg-green-100 dark:bg-green-900/30', border: 'border-gray-200 dark:border-gray-700', text: 'text-green-600 dark:text-green-400', label: '成功', nameTxt: 'text-gray-900 dark:text-gray-100', timeTxt: 'text-gray-500 dark:text-gray-400' },
                      error: { bg: 'bg-red-100 dark:bg-red-900/30', border: 'border-gray-200 dark:border-gray-700', text: 'text-red-600 dark:text-red-400', label: '失败', nameTxt: 'text-gray-900 dark:text-gray-100', timeTxt: 'text-gray-500 dark:text-gray-400' },
                    };
                    const config = statusConfig[file.status] || statusConfig.queued;
                    
                    return (
                      <div key={file.id} className={`${config.bg} rounded-lg p-2.5 border ${config.border} hover:shadow-md transition-all duration-200`}>
                        <div className="flex justify-between items-start mb-1.5">
                          <span className={`font-semibold text-xs md:text-sm truncate flex-1 ${config.nameTxt}`}>{file.name}</span>
                          <span className={`text-xs ml-2 whitespace-nowrap ${config.timeTxt}`}>{file.timestamp}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold ${config.text} px-2 py-0.5 rounded-full ${config.bg}`}>
                            {file.status === 'processing' && (
                              <span className="inline-block animate-spin rounded-full h-2 w-2 border border-current mr-1"></span>
                            )}
                            {config.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-3">
                  <EmptyState 
                    type="default" 
                    title="队列为空"
                    description="拖入文件后将显示在此处"
                    theme={theme}
                  />
                </div>
              )}
            </Card>
          </div>
          
          {/* Right Column */}
          <div className="lg:col-span-2 flex flex-col gap-2 md:gap-3">
            <Card theme={theme}>
              <div className={`flex flex-wrap gap-2 mb-3 pb-2 ${
                theme === 'blackgold' ? 'border-b border-yellow-900/30' : 'border-b border-gray-200 dark:border-gray-700'
              }`}>
                <div className="flex-1 flex flex-wrap gap-2">
                  <TabButton active={activeTab === 'chart'} onClick={() => setActiveTab('chart')} theme={theme}>
                    <span className="flex items-center justify-center">
                      <BarChart2 size={16} className="mr-2"/>CDF 分析
                    </span>
                  </TabButton>
                  <TabButton active={activeTab === 'table'} onClick={() => setActiveTab('table')} theme={theme}>
                    <span className="flex items-center justify-center">
                      <Table size={16} className="mr-2"/>数据对比
                    </span>
                  </TabButton>
                  <TabButton active={activeTab === 'trend'} onClick={() => setActiveTab('trend')} theme={theme}>
                    <span className="flex items-center justify-center">
                      <BarChart2 size={16} className="mr-2"/>趋势对比
                    </span>
                  </TabButton>
                </div>
                {/* 保存图表按钮 - 仅在图表标签页显示 */}
                {activeTab === 'chart' && analysisResult && (
                  <button
                    onClick={handleManualSaveChart}
                    className={`px-3 py-2 text-xs md:text-sm font-medium rounded-lg transition-all duration-200 shadow-md hover:shadow-lg flex items-center gap-1.5 ${
                      theme === 'blackgold'
                        ? 'text-black bg-gradient-to-r from-gold to-[#b8893d] hover:from-[#d4a850] hover:to-gold shadow-gold/30 hover:shadow-gold/50'
                        : 'text-white bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600'
                    }`}
                    title="保存图表为PNG图片"
                  >
                    <Download size={14} />
                    <span className="hidden sm:inline">保存图表</span>
                  </button>
                )}
              </div>
              
              <div>
                {activeTab === 'chart' && (
                  isProcessing && !analysisResult ? (
                    <ChartSkeleton theme={theme} />
                  ) : analysisResult ? (
                    <div>
                      <ReactECharts 
                        ref={chartRef}
                        option={chartOption} 
                        style={{ height: '384px' }} 
                        theme={darkMode ? 'dark' : 'light'}
                        notMerge={true}
                        lazyUpdate={true}
                      />
                      <div className={`mt-1 p-2 border rounded-lg ${
                        theme === 'blackgold'
                          ? 'bg-black/40 border-gold/30'
                          : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                      }`}>
                        <p className={`text-xs flex items-start gap-2 ${
                          theme === 'blackgold' ? 'text-gold/80' : 'text-blue-700 dark:text-blue-400'
                        }`}>
                          <span className="inline-block mt-0.5">💡</span>
                          <span>
                            <strong>交互提示：</strong>
                            鼠标滚轮缩放 | 框选区域放大 | 拖拽图表平移 | 点击图例显示/隐藏 | 工具栏保存图片或还原视图
                          </span>
                        </p>
                      </div>
                    </div>
                  ) : (
                    <EmptyState type="chart" theme={theme} />
                  )
                )}
                
                {activeTab === 'table' && (
                  isProcessing && (!comparisonsData || comparisonsData.rows.length === 0) ? (
                    <TableSkeleton rows={6} cols={7} theme={theme} />
                  ) : comparisonsData && comparisonsData.rows && comparisonsData.rows.length > 0 ? (
                    <div>
                      {/* 数据操作工具栏 - 增强玻璃态设计 */}
                      <div className="mb-3 flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          {!isMergeMode && !isDeleteMode ? (
                            <>
                              {/* 主题化按钮 - 合并 */}
                              {theme === 'blackgold' ? (
                                <button
                                  onClick={toggleMergeMode}
                                  className="px-3 py-1.5 text-xs md:text-sm font-medium text-amber-700/60 bg-gradient-to-br from-zinc-900/90 via-zinc-800/80 to-zinc-900/90 backdrop-blur-md border border-amber-700/40 hover:text-amber-600/80 hover:from-zinc-800/95 hover:via-zinc-700/85 hover:to-zinc-800/95 hover:border-amber-600/60 hover:shadow-lg hover:shadow-amber-900/30 rounded-lg transition-all duration-300 flex items-center gap-1.5"
                                  title="进入合并模式，选择多行数据进行平均合并"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                  </svg>
                                  <span>合并</span>
                                </button>
                              ) : (
                                <button
                                  onClick={toggleMergeMode}
                                  className="px-3 py-1.5 text-xs md:text-sm font-medium text-fuchsia-700 dark:text-fuchsia-300 bg-gradient-to-br from-fuchsia-100/70 to-pink-100/60 dark:from-fuchsia-950/40 dark:to-pink-950/30 backdrop-blur-md border border-fuchsia-300/60 dark:border-fuchsia-400/40 hover:from-fuchsia-200/80 hover:to-pink-200/70 dark:hover:from-fuchsia-900/50 dark:hover:to-pink-900/40 hover:border-fuchsia-400/80 hover:shadow-md rounded-lg transition-all duration-200 flex items-center gap-1.5"
                                  title="进入合并模式，选择多行数据进行平均合并"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                  </svg>
                                  <span>合并</span>
                                </button>
                              )}
                              
                              {/* 主题化按钮 - 删除 */}
                              {theme === 'blackgold' ? (
                                <button
                                  onClick={toggleDeleteMode}
                                  className="px-3 py-1.5 text-xs md:text-sm font-medium text-amber-700/60 bg-gradient-to-br from-zinc-900/90 via-red-950/50 to-zinc-900/90 backdrop-blur-md border border-amber-700/40 hover:text-amber-600/80 hover:from-zinc-800/95 hover:via-red-900/60 hover:to-zinc-800/95 hover:border-amber-600/60 hover:shadow-lg hover:shadow-red-900/30 rounded-lg transition-all duration-300 flex items-center gap-1.5"
                                  title="进入删除模式，选择要删除的数据行"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                  <span>删除</span>
                                </button>
                              ) : (
                                <button
                                  onClick={toggleDeleteMode}
                                  className="px-3 py-1.5 text-xs md:text-sm font-medium text-red-700 dark:text-red-300 bg-gradient-to-br from-red-100/70 to-rose-100/60 dark:from-red-950/40 dark:to-rose-950/30 backdrop-blur-md border border-red-300/60 dark:border-red-400/40 hover:from-red-200/80 hover:to-rose-200/70 dark:hover:from-red-900/50 dark:hover:to-rose-900/40 hover:border-red-400/80 hover:shadow-md rounded-lg transition-all duration-200 flex items-center gap-1.5"
                                  title="进入删除模式，选择要删除的数据行"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                  <span>删除</span>
                                </button>
                              )}
                              
                              {/* 主题化按钮 - 刷新 */}
                              {theme === 'blackgold' ? (
                                <button
                                  onClick={fetchComparisons}
                                  className="px-3 py-1.5 text-xs md:text-sm font-medium text-amber-700/60 bg-gradient-to-br from-zinc-900/90 via-zinc-800/80 to-zinc-900/90 backdrop-blur-md border border-amber-700/40 hover:text-amber-600/80 hover:from-zinc-800/95 hover:via-zinc-700/85 hover:to-zinc-800/95 hover:border-amber-600/60 hover:shadow-lg hover:shadow-amber-900/30 rounded-lg transition-all duration-300 flex items-center gap-1.5"
                                  title="刷新数据对比表格"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                  <span>刷新</span>
                                </button>
                              ) : (
                                <button
                                  onClick={fetchComparisons}
                                  className="px-3 py-1.5 text-xs md:text-sm font-medium text-blue-700 dark:text-blue-300 bg-gradient-to-br from-blue-100/70 to-cyan-100/60 dark:from-blue-950/40 dark:to-cyan-950/30 backdrop-blur-md border border-blue-300/60 dark:border-blue-400/40 hover:from-blue-200/80 hover:to-cyan-200/70 dark:hover:from-blue-900/50 dark:hover:to-cyan-900/40 hover:border-blue-400/80 hover:shadow-md rounded-lg transition-all duration-200 flex items-center gap-1.5"
                                  title="刷新数据对比表格"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                  <span>刷新</span>
                                </button>
                              )}
                            </>
                          ) : isMergeMode ? (
                            <div className="flex items-center gap-2">
                              {/* 玻璃态取消按钮 */}
                              <button
                                onClick={() => {
                                  setIsMergeMode(false);
                                  setSelectedRows(new Set());
                                }}
                                className="px-3 py-1.5 text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300 
                                  bg-gradient-to-br from-gray-200/70 to-gray-100/60 dark:from-gray-800/50 dark:to-gray-700/40 
                                  backdrop-blur-md border border-gray-300/60 dark:border-gray-600/50 
                                  hover:from-gray-300/80 hover:to-gray-200/70 dark:hover:from-gray-700/60 dark:hover:to-gray-600/50
                                  hover:shadow-md rounded-lg transition-all duration-200 flex items-center gap-1.5"
                              >
                                <X size={14} strokeWidth={2.5} />
                                <span>取消</span>
                              </button>
                              {/* 玻璃态确认按钮 */}
                              <button
                                onClick={() => setShowMergePreview(true)}
                                disabled={selectedRows.size < 2}
                                className={`px-3 py-1.5 text-xs md:text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-1.5 ${
                                  selectedRows.size >= 2
                                    ? 'text-white bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-700 hover:to-pink-700 shadow-md hover:shadow-lg border border-fuchsia-300/30'
                                    : 'text-gray-400 bg-gray-300/50 dark:bg-gray-700/40 backdrop-blur-md cursor-not-allowed opacity-60 border border-gray-400/30'
                                }`}
                                title={selectedRows.size < 2 ? '请至少选择两行数据' : '预览并确认合并'}
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                                <span>确认 ({selectedRows.size})</span>
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              {/* 玻璃态取消按钮 */}
                              <button
                                onClick={() => {
                                  setIsDeleteMode(false);
                                  setDeleteSelectedRows(new Set());
                                }}
                                className="px-3 py-1.5 text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300 
                                  bg-gradient-to-br from-gray-200/70 to-gray-100/60 dark:from-gray-800/50 dark:to-gray-700/40 
                                  backdrop-blur-md border border-gray-300/60 dark:border-gray-600/50 
                                  hover:from-gray-300/80 hover:to-gray-200/70 dark:hover:from-gray-700/60 dark:hover:to-gray-600/50
                                  hover:shadow-md rounded-lg transition-all duration-200 flex items-center gap-1.5"
                              >
                                <X size={14} strokeWidth={2.5} />
                                <span>取消</span>
                              </button>
                              {/* 玻璃态确认删除按钮 */}
                              <button
                                onClick={confirmDelete}
                                disabled={deleteSelectedRows.size === 0}
                                className={`px-3 py-1.5 text-xs md:text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-1.5 ${
                                  deleteSelectedRows.size > 0
                                    ? 'text-white bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 shadow-md hover:shadow-lg border border-red-300/30'
                                    : 'text-gray-400 bg-gray-300/50 dark:bg-gray-700/40 backdrop-blur-md cursor-not-allowed opacity-60 border border-gray-400/30'
                                }`}
                                title={deleteSelectedRows.size === 0 ? '请至少选择一行数据' : '确认删除选中的数据'}
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                <span>确认 ({deleteSelectedRows.size})</span>
                              </button>
                            </div>
                          )}
                        </div>
                        {isMergeMode && (
                          <div className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-700 dark:text-blue-400 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                            <span className="font-medium">点击行选择，至少选择2行进行合并</span>
                          </div>
                        )}
                        {isDeleteMode && (
                          <div className="px-3 py-1.5 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-400 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <span className="font-medium">点击行选择要删除的数据，删除操作不可恢复</span>
                          </div>
                        )}
                      </div>

                      {/* 数据表格 */}
                      <div 
                        className="overflow-x-auto rounded-lg"
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setContextMenu({
                            x: e.clientX,
                            y: e.clientY
                          });
                        }}
                      >
                        <table className={`min-w-full divide-y ${
                          theme === 'blackgold' ? 'divide-gold/20' : 'divide-gray-200 dark:divide-gray-700'
                        }`}>
                          <thead className={theme === 'blackgold' 
                            ? 'bg-gradient-to-r from-black/60 to-black/40 border-b border-gold/30'
                            : 'bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-700'
                          }>
                            <tr>
                              {isMergeMode && (
                                <th className={`px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider w-10 ${
                                  theme === 'blackgold' ? 'text-gold' : 'text-gray-600 dark:text-gray-300'
                                }`}>
                                  <input 
                                    type="checkbox"
                                    className="w-4 h-4 rounded border-gray-300 text-fuchsia-600 focus:ring-fuchsia-500"
                                    checked={selectedRows.size === comparisonsData.rows.length}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedRows(new Set(comparisonsData.rows.map((_, idx) => idx)));
                                      } else {
                                        setSelectedRows(new Set());
                                      }
                                    }}
                                  />
                                </th>
                              )}
                              {isDeleteMode && (
                                <th className={`px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider w-10 ${theme === 'blackgold' ? 'text-gold' : 'text-gray-600 dark:text-gray-300'}`}>
                                  <input 
                                    type="checkbox"
                                    className={`w-4 h-4 rounded focus:ring-2 ${theme === 'blackgold' ? 'border-gold/30 text-gold focus:ring-gold/50' : 'border-gray-300 text-red-600 focus:ring-red-500'}`}
                                    checked={deleteSelectedRows.size === comparisonsData.rows.length}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setDeleteSelectedRows(new Set(comparisonsData.rows.map((_, idx) => idx)));
                                      } else {
                                        setDeleteSelectedRows(new Set());
                                      }
                                    }}
                                  />
                                </th>
                              )}
                              {comparisonsData.columns.map((col, idx) => (
                                <th key={idx} className={`px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider ${
                                  theme === 'blackgold' ? 'text-gold' : 'text-gray-600 dark:text-gray-300'
                                }`}>
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                            {comparisonsData.rows.map((row, idx) => (
                              <tr 
                                key={idx} 
                                className={`transition-colors ${
                                  isMergeMode 
                                    ? selectedRows.has(idx)
                                      ? 'bg-fuchsia-50 dark:bg-fuchsia-900/20 border-l-4 border-fuchsia-500'
                                      : 'hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer'
                                    : isDeleteMode
                                      ? deleteSelectedRows.has(idx)
                                        ? 'bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500'
                                        : 'hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer'
                                      : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                                }`}
                                onClick={() => {
                                  if (isMergeMode) toggleRowSelection(idx);
                                  if (isDeleteMode) toggleDeleteRowSelection(idx);
                                }}
                              >
                                {isMergeMode && (
                                  <td className="px-3 py-2 w-10">
                                    <input 
                                      type="checkbox"
                                      className="w-4 h-4 rounded border-gray-300 text-fuchsia-600 focus:ring-fuchsia-500"
                                      checked={selectedRows.has(idx)}
                                      onChange={() => toggleRowSelection(idx)}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </td>
                                )}
                                {isDeleteMode && (
                                  <td className="px-3 py-2 w-10">
                                    <input 
                                      type="checkbox"
                                      className={`w-4 h-4 rounded focus:ring-2 ${theme === 'blackgold' ? 'border-gold/30 text-gold focus:ring-gold/50' : 'border-gray-300 text-red-600 focus:ring-red-500'}`}
                                      checked={deleteSelectedRows.has(idx)}
                                      onChange={() => toggleDeleteRowSelection(idx)}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </td>
                                )}
                                {comparisonsData.columns.map((col, colIdx) => (
                                  <td 
                                    key={colIdx} 
                                    className={`px-3 py-2 whitespace-nowrap text-xs md:text-sm ${getCellStyle(col, row[col])}`}
                                    title={col === 'source_file' && row[col]?.length > 30 ? row[col] : undefined}
                                  >
                                    {typeof row[col] === 'number' 
                                      ? row[col].toFixed(2) 
                                      : col === 'timestamp' 
                                        ? formatTimestamp(row[col])
                                        : col === 'source_file'
                                          ? formatSourceFileName(row[col])
                                          : row[col]
                                    }
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <EmptyState type="table" theme={theme} />
                  )
                )}
                
                {activeTab === 'trend' && (
                  isProcessing && (!comparisonsData || !comparisonsData.all_rows || comparisonsData.all_rows.length === 0) ? (
                    <ChartSkeleton theme={theme} />
                  ) : comparisonsData && comparisonsData.all_rows && comparisonsData.all_rows.length > 0 ? (
                    <div>
                      <ReactECharts 
                        ref={trendChartRef}
                        option={trendChartOption} 
                        style={{ height: '384px' }} 
                        theme={darkMode ? 'dark' : 'light'}
                        notMerge={true}
                        lazyUpdate={true}
                        onEvents={{
                          legendselectchanged: handleTrendLegendChange
                        }}
                      />
                      <div className={`mt-1 p-2 border rounded-lg ${
                        theme === 'blackgold'
                          ? 'bg-black/40 border-gold/30'
                          : 'bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-200 dark:border-purple-800'
                      }`}>
                        <p className={`text-xs flex items-start gap-2 ${
                          theme === 'blackgold' ? 'text-gold/80' : 'text-purple-700 dark:text-purple-400'
                        }`}>
                          <span className="inline-block mt-0.5">💡</span>
                          <span>
                            <strong>交互提示：</strong>
                            点击图例开关曲线 | 滚轮缩放 | 框选放大 | 拖拽平移 | 工具栏保存或还原
                          </span>
                        </p>
                      </div>
                    </div>
                  ) : (
                    <EmptyState type="trend" theme={theme} />
                  )
                )}
              </div>
            </Card>
            
            <Card theme={theme}>
              <h2 className={`text-lg md:text-xl font-semibold mb-3 flex items-center ${
                theme === 'blackgold' ? 'text-gold' : ''
              }`}>
                <div className={`p-1.5 rounded-lg mr-2 ${
                  theme === 'blackgold'
                    ? 'bg-gradient-to-br from-gold to-[#b8893d]'
                    : 'bg-gradient-to-br from-purple-500 to-pink-500'
                }`}>
                  <BrainCircuit size={16} className={theme === 'blackgold' ? 'text-black' : 'text-white'}/>
                </div>
                智能摘要
              </h2>
              {isProcessing && !analysisResult ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                  {[...Array(5)].map((_, i) => (
                    <StatCardSkeleton key={i} theme={theme} />
                  ))}
                </div>
              ) : analysisResult && analysisResult.comparison ? (
                <div className="space-y-3">
                  <div className={`flex items-center gap-2 text-xs md:text-sm ${
                    theme === 'blackgold' ? 'text-amber-700/60' : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                      theme === 'blackgold' ? 'bg-amber-500' : 'bg-blue-500'
                    }`}></span>
                    <span className="font-medium">与上次分析对比</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                    {Object.entries(analysisResult.comparison).map(([key, data]) => {
                      const isIncrease = data.change > 0;
                      const bgGradient = theme === 'blackgold'
                        ? isIncrease 
                          ? 'from-red-950/30 to-rose-950/20' 
                          : 'from-green-950/30 to-emerald-950/20'
                        : isIncrease 
                          ? 'from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20' 
                          : 'from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20';
                      const borderColor = theme === 'blackgold'
                        ? isIncrease ? 'border-red-900/30' : 'border-green-900/30'
                        : 'border-gray-200 dark:border-gray-700';
                      const iconColor = theme === 'blackgold'
                        ? isIncrease ? 'text-red-500/80' : 'text-green-500/80'
                        : isIncrease ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400';
                      const labelColor = theme === 'blackgold' ? 'text-amber-700/60' : 'text-gray-600 dark:text-gray-400';
                      const valueColor = theme === 'blackgold' ? 'text-amber-500/90' : 'text-gray-900 dark:text-gray-100';
                      const unitColor = theme === 'blackgold' ? 'text-amber-800/50' : 'text-gray-500 dark:text-gray-400';
                      const label = key.replace('_ms', '').replace('p', 'P').toUpperCase();
                      const Icon = isIncrease ? TrendingUp : TrendingDown;
                      
                      return (
                        <div key={key} className={`bg-gradient-to-br ${bgGradient} p-3 rounded-xl border ${borderColor} hover:shadow-md transition-all duration-200`}>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className={`text-xs font-bold tracking-wide ${labelColor}`}>{label}</div>
                            <Icon size={14} className={iconColor} />
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className={`text-base md:text-lg font-bold ${valueColor}`}>
                              {analysisResult.stats[key].toFixed(2)}
                            </span>
                            <span className={`text-xs ${unitColor}`}>ms</span>
                            <div className={`mt-1 pt-1.5 border-t ${theme === 'blackgold' ? 'border-amber-900/20' : 'border-gray-200 dark:border-gray-700'}`}>
                              <span className={`text-xs font-bold ${iconColor}`}>
                                {isIncrease ? '+' : ''}{data.change.toFixed(1)}%
                              </span>
                              <span className={`text-xs ml-1 ${unitColor}`}>
                                ({data.value.toFixed(2)})
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="py-3">
                  <EmptyState 
                    type="default" 
                    title={analysisResult ? '这是第一次分析' : '暂无分析数据'}
                    description={analysisResult ? '没有历史数据可供对比' : '拖入 CSV 文件开始分析'}
                    theme={theme}
                  />
                </div>
              )}
            </Card>
          </div>
        </main>
        
        {/* 右键菜单 */}
        {contextMenu && (
          <>
            {/* 背景遮罩 */}
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setContextMenu(null)}
            />
            <div
              className="fixed glass-card shadow-2xl rounded-xl py-1.5 z-50 border border-gray-200 dark:border-gray-700 min-w-[160px] animate-fade-in"
              style={{
                left: `${contextMenu.x}px`,
                top: `${contextMenu.y}px`
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={async () => {
                  await openComparisonsFile();
                  setContextMenu(null);
                }}
                className="w-full px-3 py-2 text-left text-xs md:text-sm hover:bg-gradient-to-r hover:from-blue-50 hover:to-cyan-50 dark:hover:from-blue-900/30 dark:hover:to-cyan-900/30 transition-all duration-150 flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium"
              >
                <ExternalLink size={14} />
                <span>打开文件</span>
              </button>
              <div className="my-1 border-t border-gray-200 dark:border-gray-700"></div>
              <button
                onClick={async () => {
                  await clearComparisons();
                  setContextMenu(null);
                }}
                className="w-full px-3 py-2 text-left text-xs md:text-sm hover:bg-gradient-to-r hover:from-red-50 hover:to-rose-50 dark:hover:from-red-900/30 dark:hover:to-rose-900/30 transition-all duration-150 flex items-center gap-2 text-red-600 dark:text-red-400 font-medium"
              >
                <Trash2 size={14} />
                <span>清除历史</span>
              </button>
            </div>
          </>
        )}

        {/* 合并预览对话框 */}
        {showMergePreview && calculateMergedData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden border border-gray-200 dark:border-gray-700">
              {/* 对话框标题 */}
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-fuchsia-50 to-pink-50 dark:from-fuchsia-900/20 dark:to-pink-900/20">
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <svg className="w-6 h-6 text-fuchsia-600 dark:text-fuchsia-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  合并预览
                </h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  即将合并 {selectedRows.size} 行数据，以下是计算后的平均值
                </p>
              </div>

              {/* 对话框内容 */}
              <div className="p-6 overflow-y-auto max-h-[calc(80vh-180px)]">
                <div className="space-y-4">
                  {/* 选中的原始数据 */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                      <span className="inline-block w-2 h-2 bg-blue-500 rounded-full"></span>
                      将被合并的数据行
                    </h4>
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                      <div className="space-y-1 text-xs">
                        {Array.from(selectedRows).map(idx => {
                          const row = comparisonsData.rows[idx];
                          return (
                            <div key={idx} className="flex items-center gap-2">
                              <span className="font-mono text-blue-600 dark:text-blue-400">#{idx + 1}</span>
                              <span 
                                className="text-gray-700 dark:text-gray-300"
                                title={row.source_file?.length > 30 ? row.source_file : undefined}
                              >
                                {formatSourceFileName(row.source_file || '未命名')}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* 合并后的数据预览 */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                      <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
                      合并后的数据
                    </h4>
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                      <div className="grid grid-cols-2 gap-3">
                        {comparisonsData.columns.map(col => (
                          <div key={col} className="bg-white dark:bg-gray-800 rounded-lg p-2.5 border border-gray-200 dark:border-gray-700">
                            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">
                              {col}
                            </div>
                            <div 
                              className="text-sm font-bold text-gray-900 dark:text-gray-100"
                              title={col === 'source_file' && calculateMergedData[col]?.length > 30 ? calculateMergedData[col] : undefined}
                            >
                              {typeof calculateMergedData[col] === 'number' 
                                ? calculateMergedData[col].toFixed(2) 
                                : col === 'timestamp'
                                  ? formatTimestamp(calculateMergedData[col])
                                  : col === 'source_file'
                                    ? formatSourceFileName(calculateMergedData[col])
                                    : calculateMergedData[col]
                              }
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 提示信息 */}
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                    <div className="flex items-start gap-2 text-xs text-yellow-700 dark:text-yellow-400">
                      <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <strong>操作提示：</strong>
                        <ul className="mt-1 space-y-0.5 list-disc list-inside">
                          <li>数值列（avg、min、max、p90、p99、p999、p9999）将计算平均值</li>
                          <li>合并后原数据行将被删除</li>
                          <li>comparisons.csv 文件将同步更新</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 对话框按钮 */}
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowMergePreview(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-all duration-200"
                >
                  取消
                </button>
                <button
                  onClick={confirmMerge}
                  disabled={isProcessing}
                  className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-all duration-200 shadow-md flex items-center gap-2 ${
                    isProcessing
                      ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed'
                      : 'bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600 hover:shadow-lg'
                  }`}
                >
                  {isProcessing ? (
                    <>
                      <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      <span>处理中...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>确认合并</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;


