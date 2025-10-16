import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import { File, UploadCloud, BarChart2, Table, BrainCircuit, Moon, Sun, AlertTriangle, FolderOpen, Trash2, ExternalLink } from 'lucide-react';
// Tauri v2 正确的导入方式
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { writeFile } from '@tauri-apps/plugin-fs';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { openPath, revealItemInDir } from '@tauri-apps/plugin-opener';

// --- Helper Components for UI Styling ---
const Card = ({ children, className = '' }) => (
  <div className={`bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm shadow-lg rounded-xl p-6 ${className}`}>
    {children}
  </div>
);

const TabButton = ({ children, active, onClick }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
      active
        ? 'bg-blue-600 text-white'
        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
    }`}
  >
    {children}
  </button>
);

// --- Main Application Component ---
function App() {
  const [files, setFiles] = useState([]);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [activeTab, setActiveTab] = useState('chart');
  const [darkMode, setDarkMode] = useState(false); // 默认明亮模式
  const [lastError, setLastError] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isOverDropZone, setIsOverDropZone] = useState(false); // 是否在拖拽区域内
  const dropZoneRef = useRef(null); // 引用拖拽区域元素
  const [comparisonsData, setComparisonsData] = useState(null); // comparisons.csv 数据
  const chartRef = useRef(null); // 引用 ECharts 实例
  const [inputDir, setInputDir] = useState(''); // 输入文件根目录
  const [outputBaseDir, setOutputBaseDir] = useState(''); // 输出结果文件夹根目录
  const [contextMenu, setContextMenu] = useState(null); // 右键菜单状态
  const [comparisonsFilePath, setComparisonsFilePath] = useState(''); // comparisons.csv 完整路径
  const [backendStatus, setBackendStatus] = useState('connecting'); // 后端状态: connecting, ready, error


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

  // 清除历史记录
  const clearComparisons = useCallback(async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/clear-comparisons', {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setComparisonsData({ rows: [], columns: [], all_rows: [] });
        console.log('Comparisons cleared successfully');
      }
    } catch (error) {
      console.error("Failed to clear comparisons:", error);
      setLastError('清除历史记录失败: ' + error.message);
    }
  }, []);

  // 打开 comparisons.csv 文件
  const openComparisonsFile = useCallback(async () => {
    try {
      if (!comparisonsFilePath) {
        setLastError('无法获取文件路径');
        return;
      }
      // 在文件资源管理器中显示并选中 comparisons.csv 文件
      await revealItemInDir(comparisonsFilePath);
      console.log('Revealing comparisons.csv in explorer...');
    } catch (error) {
      console.error("Failed to open comparisons file:", error);
      setLastError('打开文件失败: ' + error.message);
    }
  }, [comparisonsFilePath]);

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
        handleFileDrop(paths);
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

  // 等待后端就绪
  const waitForBackend = useCallback(async () => {
    const maxAttempts = 30; // 最多等待 15 秒
    
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch('http://127.0.0.1:8000/health', {
          signal: AbortSignal.timeout(500)
        });
        if (response.ok) {
          console.log('Backend is ready!');
          setBackendStatus('ready');
          return true;
        }
      } catch (error) {
        // 继续重试
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.warn('Backend failed to start in time');
    setBackendStatus('error');
    setLastError('后端服务启动超时，请检查是否有其他程序占用 8000 端口');
    return false;
  }, []);

  // 初始化：等待后端就绪后加载数据
  useEffect(() => {
    const initialize = async () => {
      await waitForBackend();
      await loadConfig();
      await fetchComparisons();
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
        backgroundColor: darkMode ? '#1f2937' : '#ffffff'
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
      setLastError('自动保存图表失败: ' + error.message);
    }
  }, [analysisResult, darkMode]);

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
    
    setLastError(null); // Clear previous errors
    const timestamp = new Date().toLocaleString('zh-CN', { 
      month: '2-digit', 
      day: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    // 自动提取并保存输入目录（从第一个文件）
    if (paths.length > 0 && !inputDir) {
      const firstFilePath = paths[0];
      const directory = firstFilePath.substring(0, firstFilePath.lastIndexOf('\\'));
      setInputDir(directory);
      await saveConfig(directory, outputBaseDir);
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
        
        // 刷新 comparisons 数据
        await fetchComparisons();

      } catch (error) {
        console.error("Error processing file:", error);
        const errorMessage = error.message.includes('Failed to fetch') 
          ? '无法连接到后端服务。请确保Python服务正在运行。'
          : error.message;

        setFiles(prevFiles => prevFiles.map(f => f.id === file.id ? { ...f, status: 'error', result: errorMessage } : f));
        setLastError(errorMessage);
        setAnalysisResult(null);
      }
    }
  }, [fetchComparisons, inputDir, outputBaseDir, saveConfig, backendStatus]);

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
                  handleFileDrop(paths);
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
  }, [handleFileDrop]);
  // --- Chart Options ---
  const chartOption = useMemo(() => {
    if (!analysisResult || !analysisResult.chart_data) return {};
    const stats = analysisResult.stats;
    const { x, y } = analysisResult.chart_data;
    
    // 计算 X 轴的合理范围：取 P99.9 或最大值的 1.1 倍
    const maxRTT = Math.max(...x);
    const xAxisMax = Math.min(stats.p999_ms * 1.2, maxRTT);

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params) => {
          if (params && params.length > 0) {
            const point = params[0];
            const rtt = point.data[0].toFixed(2);
            const cdf = (point.data[1] * 100).toFixed(2);
            return `RTT: ${rtt} ms<br />CDF: ${cdf}%`;
          }
          return '';
        },
      },
      xAxis: {
        type: 'value',
        name: 'RTT (ms)',
        nameTextStyle: { color: darkMode ? '#ccc' : '#333' },
        axisLine: { lineStyle: { color: darkMode ? '#ccc' : '#333' } },
        max: xAxisMax, // 设置最大值为合理范围
      },
      yAxis: {
        type: 'value',
        name: 'CDF',
        nameTextStyle: { color: darkMode ? '#ccc' : '#333' },
        axisLine: { lineStyle: { color: darkMode ? '#ccc' : '#333' } },
        min: 0,
        max: 1,
        axisLabel: {
          formatter: (value) => (value * 100).toFixed(0) + '%'
        }
      },
      series: [{
        data: y.map((val, index) => [x[index], val]),
        type: 'line',
        smooth: true,
        showSymbol: false,
        lineStyle: {
          color: '#3b82f6',
          width: 2,
        },
        markLine: {
          symbol: 'none',
          animation: false,
          label: {
            position: 'end',
            formatter: '{b}',
            fontSize: 11,
          },
          lineStyle: {
            type: 'dashed',
            width: 2,
          },
          data: [
            { 
              name: `Mean: ${stats.mean_ms.toFixed(2)}ms`, 
              xAxis: stats.mean_ms,
              lineStyle: { color: '#10b981' },
              label: { color: '#10b981', position: 'insideEndTop' }
            },
            { 
              name: `P50: ${stats.p50_ms.toFixed(2)}ms`, 
              xAxis: stats.p50_ms,
              lineStyle: { color: '#f59e0b' },
              label: { color: '#f59e0b', position: 'insideEndTop' }
            },
            { 
              name: `P90: ${stats.p90_ms.toFixed(2)}ms`, 
              xAxis: stats.p90_ms,
              lineStyle: { color: '#ef4444' },
              label: { color: '#ef4444', position: 'insideEndTop' }
            },
            { 
              name: `P99: ${stats.p99_ms.toFixed(2)}ms`, 
              xAxis: stats.p99_ms,
              lineStyle: { color: '#8b5cf6' },
              label: { color: '#8b5cf6', position: 'insideEndTop' }
            },
            { 
              name: `P99.9: ${stats.p999_ms.toFixed(2)}ms`, 
              xAxis: stats.p999_ms,
              lineStyle: { color: '#ec4899' },
              label: { color: '#ec4899', position: 'insideEndTop' }
            },
          ],
        },
      }],
      grid: {
        left: '3%',
        right: '4%',
        bottom: '10%',
        top: '10%',
        containLabel: true,
      },
    };
  }, [analysisResult, darkMode]);

  // --- Trend Chart Options ---
  const trendChartOption = useMemo(() => {
    if (!comparisonsData || !comparisonsData.all_rows || comparisonsData.all_rows.length === 0) return {};

    const allRows = comparisonsData.all_rows;
    const xData = allRows.map((_, index) => index + 1); // 序号

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross'
        }
      },
      legend: {
        data: ['Mean', 'P50', 'P90', 'P99', 'P99.9'],
        textStyle: { color: darkMode ? '#ccc' : '#333' }
      },
      xAxis: {
        type: 'category',
        data: xData,
        name: '序号',
        nameTextStyle: { color: darkMode ? '#ccc' : '#333' },
        axisLine: { lineStyle: { color: darkMode ? '#ccc' : '#333' } }
      },
      yAxis: {
        type: 'value',
        name: 'RTT (ms)',
        nameTextStyle: { color: darkMode ? '#ccc' : '#333' },
        axisLine: { lineStyle: { color: darkMode ? '#ccc' : '#333' } }
      },
      series: [
        {
          name: 'Mean',
          type: 'line',
          data: allRows.map(row => row.mean_ms),
          smooth: true,
          lineStyle: { color: '#10b981', width: 2 },
          itemStyle: { color: '#10b981' }
        },
        {
          name: 'P50',
          type: 'line',
          data: allRows.map(row => row.p50_ms),
          smooth: true,
          lineStyle: { color: '#f59e0b', width: 2 },
          itemStyle: { color: '#f59e0b' }
        },
        {
          name: 'P90',
          type: 'line',
          data: allRows.map(row => row.p90_ms),
          smooth: true,
          lineStyle: { color: '#ef4444', width: 2 },
          itemStyle: { color: '#ef4444' }
        },
        {
          name: 'P99',
          type: 'line',
          data: allRows.map(row => row.p99_ms),
          smooth: true,
          lineStyle: { color: '#8b5cf6', width: 2 },
          itemStyle: { color: '#8b5cf6' }
        },
        {
          name: 'P99.9',
          type: 'line',
          data: allRows.map(row => row.p999_ms),
          smooth: true,
          lineStyle: { color: '#ec4899', width: 2 },
          itemStyle: { color: '#ec4899' }
        }
      ],
      grid: {
        left: '3%',
        right: '4%',
        bottom: '10%',
        top: '15%',
        containLabel: true
      }
    };
  }, [comparisonsData, darkMode]);
  
  // --- UI Rendering ---
  return (
    <div className={`min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-8 transition-colors font-sans`}>
      <div className="max-w-7xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">RTT 数据分析工具</h1>
          <div className="flex items-center gap-4">
            {/* 后端状态指示器 */}
            {backendStatus === 'connecting' && (
              <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400">
                <div className="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-yellow-600 dark:border-yellow-400"></div>
                <span>正在连接后端...</span>
              </div>
            )}
            {backendStatus === 'ready' && (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <div className="inline-block rounded-full h-2 w-2 bg-green-600 dark:bg-green-400"></div>
                <span>后端已就绪</span>
              </div>
            )}
            {backendStatus === 'error' && (
              <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                <AlertTriangle size={16} />
                <span>后端连接失败</span>
              </div>
            )}
            <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </header>

        {lastError && (
          <div className="bg-red-100 dark:bg-red-900/50 border-l-4 border-red-500 text-red-700 dark:text-red-200 p-4 rounded-md mb-6" role="alert">
            <div className="flex">
              <div className="py-1"><AlertTriangle className="h-6 w-6 text-red-500 mr-4"/></div>
              <div>
                <p className="font-bold">错误</p>
                <p className="text-sm">{lastError}</p>
              </div>
            </div>
          </div>
        )}
        
        <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column */}
          <div className="lg:col-span-1 flex flex-col gap-8">
            {/* 目录配置 */}
            <Card>
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <FolderOpen size={20} className="mr-2"/>目录配置
              </h2>
              
              {/* 输入文件根目录 */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  输入文件目录
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputDir}
                    onChange={(e) => setInputDir(e.target.value)}
                    onBlur={() => saveConfig(inputDir, outputBaseDir)}
                    placeholder="选择输入文件所在目录"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={selectInputDir}
                    className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    <FolderOpen size={18} />
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  拖入文件时会自动配置此目录
                </p>
              </div>
              
              {/* 输出结果文件夹根目录 */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  输出结果目录
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={outputBaseDir}
                    onChange={(e) => setOutputBaseDir(e.target.value)}
                    onBlur={() => saveConfig(inputDir, outputBaseDir)}
                    placeholder="选择输出结果根目录（可选）"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={selectOutputBaseDir}
                    className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    <FolderOpen size={18} />
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  未配置时，结果将保存在输入文件所在目录
                </p>
              </div>
            </Card>
            
            <div 
              ref={dropZoneRef}
              onClick={backendStatus === 'ready' ? openFileDialog : undefined}
              className={`relative bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm shadow-lg rounded-xl p-6 flex flex-col items-center justify-center border-2 border-dashed h-64 transition-colors ${
                backendStatus !== 'ready' 
                  ? 'opacity-50 cursor-not-allowed border-gray-300 dark:border-gray-600' 
                  : `cursor-pointer ${isDragOver && isOverDropZone ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/50' : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/30'}`
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
                    opacity: 0.35,
                    borderRadius: '0.75rem',
                    pointerEvents: 'none',
                    zIndex: 0
                  }}
                />
              )}
              
              {/* 文字层 */}
              <div className="relative z-10 flex flex-col items-center w-full">
                <UploadCloud size={48} className="text-gray-400 dark:text-gray-500 mb-4" />
                <p className="text-lg font-semibold">
                  {backendStatus === 'ready' ? '拖拽文件到此区域' : '等待后端就绪...'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {backendStatus === 'ready' ? '或点击选择文件' : '正在启动后端服务'}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                  {backendStatus === 'ready' ? '支持一个或多个 .csv 文件' : '请稍候...'}
                </p>
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
                    opacity: 0.75, // 前景图透明度，可以看到下方的文字
                    borderRadius: '0.75rem',
                    pointerEvents: 'none',
                    zIndex: 20 // 显示在文字上方
                  }}
                />
              )}
            </div>
            
            <Card>
              <h2 className="text-xl font-semibold mb-4 flex items-center"><File size={20} className="mr-2"/>处理队列</h2>
              {files.length > 0 ? (
                <div className="max-h-48 overflow-y-auto">
                  <ul className="space-y-2">
                    {files.map(file => (
                      <li key={file.id} className="text-sm border-b border-gray-200 dark:border-gray-700 pb-2">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{file.name}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">{file.timestamp}</span>
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          状态: <span className="font-medium">{file.status}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">队列为空</p>
              )}
            </Card>
          </div>
          
          {/* Right Column */}
          <div className="lg:col-span-2 flex flex-col gap-8">
            <Card>
              <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700 mb-4 pb-2">
                  <TabButton active={activeTab === 'chart'} onClick={() => setActiveTab('chart')}>
                    <span className="flex items-center justify-center">
                      <BarChart2 size={16} className="mr-2"/>CDF 分析
                    </span>
                  </TabButton>
                  <TabButton active={activeTab === 'table'} onClick={() => setActiveTab('table')}>
                    <span className="flex items-center justify-center">
                      <Table size={16} className="mr-2"/>数据对比
                    </span>
                  </TabButton>
                  <TabButton active={activeTab === 'trend'} onClick={() => setActiveTab('trend')}>
                    <span className="flex items-center justify-center">
                      <BarChart2 size={16} className="mr-2"/>趋势对比
                    </span>
                  </TabButton>
              </div>
              
              <div>
                {activeTab === 'chart' && (
                  analysisResult ? (
                    <ReactECharts 
                      ref={chartRef}
                      option={chartOption} 
                      style={{ height: '400px' }} 
                      theme={darkMode ? 'dark' : 'light'} 
                    />
                  ) : (
                    <div className="h-96 flex items-center justify-center text-gray-500 dark:text-gray-400">暂无数据。请拖入一个CSV文件开始分析。</div>
                  )
                )}
                
                {activeTab === 'table' && (
                  comparisonsData && comparisonsData.rows && comparisonsData.rows.length > 0 ? (
                    <div 
                      className="overflow-x-auto"
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenu({
                          x: e.clientX,
                          y: e.clientY
                        });
                      }}
                    >
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                          <tr>
                            {comparisonsData.columns.map((col, idx) => (
                              <th key={idx} className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                          {comparisonsData.rows.map((row, idx) => (
                            <tr key={idx}>
                              {comparisonsData.columns.map((col, colIdx) => (
                                <td key={colIdx} className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                  {typeof row[col] === 'number' ? row[col].toFixed(2) : row[col]}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="h-96 flex items-center justify-center text-gray-500 dark:text-gray-400">
                      暂无对比数据。
                    </div>
                  )
                )}
                
                {activeTab === 'trend' && (
                  comparisonsData && comparisonsData.all_rows && comparisonsData.all_rows.length > 0 ? (
                    <div>
                      <ReactECharts option={trendChartOption} style={{ height: '400px' }} theme={darkMode ? 'dark' : 'light'} />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                        💡 提示：点击图例可以开关对应曲线的显示
                      </p>
                    </div>
                  ) : (
                    <div className="h-96 flex items-center justify-center text-gray-500 dark:text-gray-400">
                      暂无趋势数据。
                    </div>
                  )
                )}
              </div>
            </Card>
            
            <Card>
              <h2 className="text-xl font-semibold mb-4 flex items-center"><BrainCircuit size={20} className="mr-2"/>智能摘要</h2>
              {analysisResult && analysisResult.comparison ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">与上次对比：</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    {Object.entries(analysisResult.comparison).map(([key, data]) => {
                      const isIncrease = data.change > 0;
                      const colorClass = isIncrease ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400';
                      const label = key.replace('_ms', '').replace('p', 'P').toUpperCase();
                      
                      return (
                        <div key={key} className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-semibold">{label}</div>
                          <div className="flex flex-col gap-1">
                            <span className="text-base font-bold text-gray-900 dark:text-gray-100">
                              {analysisResult.stats[key].toFixed(2)} ms
                            </span>
                            <span className={`text-xs font-semibold ${colorClass}`}>
                              {isIncrease ? '↑' : '↓'} {Math.abs(data.change).toFixed(1)}%
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              上次: {data.value.toFixed(2)} ms
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {analysisResult ? '这是第一次分析，暂无对比数据。' : '暂无分析。拖入文件以生成智能摘要。'}
                </p>
              )}
            </Card>
          </div>
        </main>
        
        {/* 右键菜单 */}
        {contextMenu && (
          <div
            className="fixed bg-white dark:bg-gray-800 shadow-lg rounded-md py-2 z-50 border border-gray-200 dark:border-gray-700"
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
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-blue-600 dark:text-blue-400"
            >
              <ExternalLink size={16} />
              打开文件
            </button>
            <button
              onClick={async () => {
                await clearComparisons();
                setContextMenu(null);
              }}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-red-600 dark:text-red-400"
            >
              <Trash2 size={16} />
              清除历史
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

