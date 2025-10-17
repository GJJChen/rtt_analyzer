import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import { File, UploadCloud, BarChart2, Table, BrainCircuit, Moon, Sun, AlertTriangle, FolderOpen, Trash2, ExternalLink, TrendingUp, TrendingDown } from 'lucide-react';
// Tauri v2 正确的导入方式
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { writeFile } from '@tauri-apps/plugin-fs';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { openPath, revealItemInDir } from '@tauri-apps/plugin-opener';
import { ToastContainer } from './components/Toast';
import { ChartSkeleton, TableSkeleton, StatCardSkeleton } from './components/Skeleton';
import EmptyState from './components/EmptyState';

// --- Helper Components for UI Styling ---
const Card = ({ children, className = '' }) => (
  <div className={`glass-card shadow-xl rounded-xl p-4 md:p-5 animate-fade-in ${className}`}>
    {children}
  </div>
);

const TabButton = ({ children, active, onClick }) => (
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

// --- Main Application Component ---
function App() {
  const [files, setFiles] = useState([]);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [activeTab, setActiveTab] = useState('chart');
  const [darkMode, setDarkMode] = useState(false); // 默认明亮模式
  const [isDragOver, setIsDragOver] = useState(false);
  const [isOverDropZone, setIsOverDropZone] = useState(false); // 是否在拖拽区域内
  const dropZoneRef = useRef(null); // 引用拖拽区域元素
  const handleFileDropRef = useRef(null); // 引用最新的 handleFileDrop 函数
  const [comparisonsData, setComparisonsData] = useState(null); // comparisons.csv 数据
  const chartRef = useRef(null); // 引用 ECharts 实例
  const [inputDir, setInputDir] = useState(''); // 输入文件根目录
  const [outputBaseDir, setOutputBaseDir] = useState(''); // 输出结果文件夹根目录
  const [contextMenu, setContextMenu] = useState(null); // 右键菜单状态
  const [comparisonsFilePath, setComparisonsFilePath] = useState(''); // comparisons.csv 完整路径
  const [backendStatus, setBackendStatus] = useState('connecting'); // 后端状态: connecting, ready, error
  const [toasts, setToasts] = useState([]); // Toast通知列表
  const [isProcessing, setIsProcessing] = useState(false); // 处理中状态

  // Toast管理函数
  const addToast = useCallback((message, type = 'info', duration = 4000) => {
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

  // 清除历史记录
  const clearComparisons = useCallback(async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/clear-comparisons', {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setComparisonsData({ rows: [], columns: [], all_rows: [] });
        addToast('历史记录已清除', 'success', 3000);
        console.log('Comparisons cleared successfully');
      }
    } catch (error) {
      console.error("Failed to clear comparisons:", error);
      addToast('清除历史记录失败: ' + error.message, 'error');
    }
  }, [addToast]);

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
          addToast('后端服务已就绪', 'success', 3000);
          return true;
        }
      } catch (error) {
        // 继续重试
      }
      await new Promise(resolve => setTimeout(resolve, 500));
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
        backgroundColor: darkMode ? '#1f2937' : '#ffffff',
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
  }, [analysisResult, darkMode, addToast]);

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
        addToast(`成功分析文件: ${file.name}`, 'success', 3000);
        
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
  }, [fetchComparisons, inputDir, outputBaseDir, saveConfig, backendStatus, addToast]);

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
            return `<div style="padding: 4px;">
              <strong>RTT:</strong> ${rtt} ms<br />
              <strong>CDF:</strong> ${cdf}%
            </div>`;
          }
          return '';
        },
        backgroundColor: darkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        borderColor: darkMode ? '#4b5563' : '#e5e7eb',
        borderWidth: 1,
        textStyle: {
          color: darkMode ? '#f3f4f6' : '#111827'
        },
        extraCssText: 'box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);'
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
            title: '保存为图片',
            pixelRatio: 2,
            backgroundColor: darkMode ? '#1f2937' : '#ffffff',
            excludeComponents: ['toolbox', 'dataZoom'] // 保存时排除工具箱和缩放滑动条
          }
        },
        iconStyle: {
          borderColor: darkMode ? '#9ca3af' : '#6b7280'
        },
        emphasis: {
          iconStyle: {
            borderColor: darkMode ? '#3b82f6' : '#2563eb'
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
          height: 20,
          bottom: 10,
          show: true, // 在界面上显示
          showDetail: false, // 不显示详细数值
          borderColor: darkMode ? '#4b5563' : '#d1d5db',
          fillerColor: darkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.15)',
          handleStyle: {
            color: darkMode ? '#3b82f6' : '#2563eb',
            borderColor: darkMode ? '#60a5fa' : '#3b82f6'
          },
          textStyle: {
            color: darkMode ? '#9ca3af' : '#6b7280'
          },
          // 关键：保存图片时不包含滑动条
          emphasis: {
            handleStyle: {
              shadowBlur: 3,
              shadowColor: darkMode ? 'rgba(59, 130, 246, 0.4)' : 'rgba(37, 99, 235, 0.4)'
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
        nameTextStyle: { color: darkMode ? '#ccc' : '#333', fontSize: 12 },
        nameGap: 25, // 标签与轴线的距离
        axisLine: { lineStyle: { color: darkMode ? '#ccc' : '#333' } },
        max: xAxisMax, // 设置最大值为合理范围
        axisLabel: {
          color: darkMode ? '#9ca3af' : '#6b7280'
        }
      },
      yAxis: {
        type: 'value',
        name: 'CDF',
        nameLocation: 'middle', // 标签位置在中间
        nameTextStyle: { color: darkMode ? '#ccc' : '#333', fontSize: 12 },
        nameGap: 35, // 标签与轴线的距离
        axisLine: { lineStyle: { color: darkMode ? '#ccc' : '#333' } },
        min: 0,
        max: 1,
        axisLabel: {
          formatter: (value) => (value * 100).toFixed(0) + '%',
          color: darkMode ? '#9ca3af' : '#6b7280'
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
        left: '6%', // 增加左侧空间以显示Y轴标签
        right: '4%',
        bottom: '18%', // 增加底部空间以容纳滑动条和X轴标签
        top: '12%', // 增加顶部空间以容纳工具箱
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
          type: 'cross',
          crossStyle: {
            color: darkMode ? '#9ca3af' : '#6b7280'
          }
        },
        backgroundColor: darkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        borderColor: darkMode ? '#4b5563' : '#e5e7eb',
        borderWidth: 1,
        textStyle: {
          color: darkMode ? '#f3f4f6' : '#111827'
        },
        extraCssText: 'box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);'
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
            title: '保存为图片',
            pixelRatio: 2,
            backgroundColor: darkMode ? '#1f2937' : '#ffffff',
            excludeComponents: ['toolbox', 'dataZoom'] // 保存时排除工具箱和缩放滑动条
          }
        },
        iconStyle: {
          borderColor: darkMode ? '#9ca3af' : '#6b7280'
        },
        emphasis: {
          iconStyle: {
            borderColor: darkMode ? '#3b82f6' : '#2563eb'
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
          height: 20,
          bottom: 10,
          show: true,
          showDetail: false,
          borderColor: darkMode ? '#4b5563' : '#d1d5db',
          fillerColor: darkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.15)',
          handleStyle: {
            color: darkMode ? '#3b82f6' : '#2563eb',
            borderColor: darkMode ? '#60a5fa' : '#3b82f6'
          },
          textStyle: {
            color: darkMode ? '#9ca3af' : '#6b7280'
          },
          emphasis: {
            handleStyle: {
              shadowBlur: 3,
              shadowColor: darkMode ? 'rgba(59, 130, 246, 0.4)' : 'rgba(37, 99, 235, 0.4)'
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
        data: ['Mean', 'P50', 'P90', 'P99', 'P99.9'],
        textStyle: { color: darkMode ? '#ccc' : '#333' },
        top: 5
      },
      xAxis: {
        type: 'category',
        data: xData,
        name: '序号',
        nameLocation: 'middle', // 标签位置在中间
        nameTextStyle: { color: darkMode ? '#ccc' : '#333', fontSize: 12 },
        nameGap: 25, // 标签与轴线的距离
        axisLine: { lineStyle: { color: darkMode ? '#ccc' : '#333' } },
        axisLabel: {
          color: darkMode ? '#9ca3af' : '#6b7280'
        }
      },
      yAxis: {
        type: 'value',
        name: 'RTT (ms)',
        nameLocation: 'middle', // 标签位置在中间
        nameTextStyle: { color: darkMode ? '#ccc' : '#333', fontSize: 12 },
        nameGap: 35, // 标签与轴线的距离
        axisLine: { lineStyle: { color: darkMode ? '#ccc' : '#333' } },
        axisLabel: {
          color: darkMode ? '#9ca3af' : '#6b7280'
        }
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
        left: '6%', // 增加左侧空间以显示Y轴标签
        right: '4%',
        bottom: '15%', // 增加底部空间以显示X轴标签
        top: '15%',
        containLabel: true
      }
    };
  }, [comparisonsData, darkMode]);
  
  // --- UI Rendering ---
  return (
    <div className={`min-h-screen bg-gradient-mesh bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 md:p-6 transition-colors font-sans`}>
      {/* Toast通知容器 */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      <div className="max-w-7xl mx-auto">
        <header className="flex justify-between items-center mb-4 md:mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
              RTT Analyzer
            </h1>
            <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              RTT数据统计分析与可视化平台
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* 后端状态指示器 */}
            {backendStatus === 'connecting' && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-sm text-yellow-700 dark:text-yellow-400">
                <div className="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-yellow-600 dark:border-yellow-400"></div>
                <span className="font-medium">连接中</span>
              </div>
            )}
            {backendStatus === 'ready' && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-900/30 text-sm text-green-700 dark:text-green-400">
                <div className="inline-block rounded-full h-2 w-2 bg-green-600 dark:bg-green-400 animate-pulse"></div>
                <span className="font-medium">已就绪</span>
              </div>
            )}
            {backendStatus === 'error' && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-100 dark:bg-red-900/30 text-sm text-red-700 dark:text-red-400">
                <AlertTriangle size={16} />
                <span className="font-medium">连接失败</span>
              </div>
            )}
            <button 
              onClick={() => setDarkMode(!darkMode)} 
              className="p-2.5 rounded-full transition-all duration-200 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 shadow-md motion-safe:transform hover:-translate-y-0.5 active:translate-y-0 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-400/60"
            >
              {darkMode ? <Sun size={20} className="text-yellow-500" /> : <Moon size={20} className="text-indigo-600" />}
            </button>
          </div>
        </header>
        
        <main className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Left Column */}
          <div className="lg:col-span-1 flex flex-col gap-4 md:gap-5">
            {/* 目录配置 */}
            <Card>
              <h2 className="text-lg md:text-xl font-semibold mb-3 flex items-center">
                <FolderOpen size={18} className="mr-2"/>目录配置
              </h2>
              
              {/* 输入文件根目录 */}
              <div className="mb-3">
                <label className="block text-xs md:text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                  输入文件目录
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputDir}
                    onChange={(e) => setInputDir(e.target.value)}
                    onBlur={() => saveConfig(inputDir, outputBaseDir)}
                    placeholder="选择输入文件所在目录"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                  />
                  <button
                    onClick={selectInputDir}
                    className="px-3 py-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg transition-all duration-200 hover:from-blue-700 hover:to-blue-600 hover:shadow-lg active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
                  >
                    <FolderOpen size={16} />
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                  <span className="inline-block w-1 h-1 bg-gray-400 rounded-full"></span>
                  拖入文件时会自动配置此目录
                </p>
              </div>
              
              {/* 输出结果文件夹根目录 */}
              <div>
                <label className="block text-xs md:text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                  输出结果目录
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={outputBaseDir}
                    onChange={(e) => setOutputBaseDir(e.target.value)}
                    onBlur={() => saveConfig(inputDir, outputBaseDir)}
                    placeholder="选择输出结果根目录（可选）"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                  />
                  <button
                    onClick={selectOutputBaseDir}
                    className="px-3 py-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg transition-all duration-200 hover:from-blue-700 hover:to-blue-600 hover:shadow-lg active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
                  >
                    <FolderOpen size={16} />
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                  <span className="inline-block w-1 h-1 bg-gray-400 rounded-full"></span>
                  未配置时，结果将保存在输入文件所在目录
                </p>
              </div>
            </Card>
            
            <div 
              ref={dropZoneRef}
              onClick={backendStatus === 'ready' ? openFileDialog : undefined}
              className={`group relative glass-card shadow-xl flex flex-col items-center justify-center border-2 border-dashed h-48 md:h-56 transition-all duration-300 ease-out motion-safe:transform ${
                backendStatus !== 'ready' 
                  ? 'opacity-50 cursor-not-allowed border-gray-300 dark:border-gray-600' 
                  : `cursor-pointer ${isDragOver && isOverDropZone 
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
                    opacity: 0.25,
                    borderRadius: '1rem',
                    pointerEvents: 'none',
                    zIndex: 0
                  }}
                />
              )}
              
              {/* 文字层 */}
              <div className="relative z-10 flex flex-col items-center w-full">
                <div className={`mb-3 p-3 rounded-full transition-all duration-300 ${
                  isDragOver && isOverDropZone 
                    ? 'bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg scale-110' 
                    : 'bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 group-hover:from-blue-400 group-hover:to-cyan-400 group-hover:scale-105'
                }`}>
                  <UploadCloud 
                    size={40} 
                    className={`transition-colors duration-300 ${
                      isDragOver && isOverDropZone 
                        ? 'text-white' 
                        : 'text-gray-500 dark:text-gray-400 group-hover:text-white'
                    }`} 
                  />
                </div>
                <p className="text-base md:text-lg font-semibold mb-1">
                  {backendStatus === 'ready' ? (
                    isDragOver && isOverDropZone ? '松开鼠标即可上传' : '拖拽文件到此区域'
                  ) : '等待后端就绪...'}
                </p>
                <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
                  {backendStatus === 'ready' ? '或点击选择文件' : '正在启动后端服务'}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                  {backendStatus === 'ready' ? '支持一个或多个 .csv 文件' : '请稍候...'}
                </p>
                {isProcessing && (
                  <div className="mt-3 flex items-center gap-2 text-xs md:text-sm text-blue-600 dark:text-blue-400">
                    <div className="inline-block animate-spin rounded-full h-3 w-3 border-t-2 border-b-2 border-blue-600 dark:border-blue-400"></div>
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
                    opacity: 0.6,
                    borderRadius: '1rem',
                    pointerEvents: 'none',
                    zIndex: 20
                  }}
                />
              )}
            </div>
            
            <Card>
              <h2 className="text-lg md:text-xl font-semibold mb-3 flex items-center">
                <div className="p-1.5 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg mr-2">
                  <File size={16} className="text-white"/>
                </div>
                处理队列
                {files.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full font-bold">
                    {files.length}
                  </span>
                )}
              </h2>
              {files.length > 0 ? (
                <div className="max-h-48 md:max-h-56 overflow-y-auto pr-1 space-y-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                  {files.map(file => {
                    const statusConfig = {
                      queued: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', label: '等待中' },
                      processing: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', label: '处理中' },
                      success: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400', label: '成功' },
                      error: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400', label: '失败' },
                    };
                    const config = statusConfig[file.status] || statusConfig.queued;
                    
                    return (
                      <div key={file.id} className={`${config.bg} rounded-lg p-2.5 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-200`}>
                        <div className="flex justify-between items-start mb-1.5">
                          <span className="font-semibold text-gray-900 dark:text-gray-100 text-xs md:text-sm truncate flex-1">{file.name}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 whitespace-nowrap">{file.timestamp}</span>
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
                  />
                </div>
              )}
            </Card>
          </div>
          
          {/* Right Column */}
          <div className="lg:col-span-2 flex flex-col gap-4 md:gap-5">
            <Card>
              <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700 mb-3 pb-2">
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
                  isProcessing && !analysisResult ? (
                    <ChartSkeleton />
                  ) : analysisResult ? (
                    <div>
                      <ReactECharts 
                        ref={chartRef}
                        option={chartOption} 
                        style={{ height: '380px' }} 
                        theme={darkMode ? 'dark' : 'light'} 
                      />
                      <div className="mt-2 p-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <p className="text-xs text-blue-700 dark:text-blue-400 flex items-start gap-2">
                          <span className="inline-block mt-0.5">💡</span>
                          <span>
                            <strong>交互提示：</strong>
                            鼠标滚轮缩放 | 框选区域放大 | 拖拽图表平移 | 工具栏保存图片或还原视图
                          </span>
                        </p>
                      </div>
                    </div>
                  ) : (
                    <EmptyState type="chart" />
                  )
                )}
                
                {activeTab === 'table' && (
                  isProcessing && (!comparisonsData || comparisonsData.rows.length === 0) ? (
                    <TableSkeleton rows={6} cols={7} />
                  ) : comparisonsData && comparisonsData.rows && comparisonsData.rows.length > 0 ? (
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
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-700">
                          <tr>
                            {comparisonsData.columns.map((col, idx) => (
                              <th key={idx} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                          {comparisonsData.rows.map((row, idx) => (
                            <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                              {comparisonsData.columns.map((col, colIdx) => (
                                <td key={colIdx} className="px-3 py-2 whitespace-nowrap text-xs md:text-sm text-gray-900 dark:text-gray-100">
                                  {typeof row[col] === 'number' ? row[col].toFixed(2) : row[col]}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <EmptyState type="table" />
                  )
                )}
                
                {activeTab === 'trend' && (
                  isProcessing && (!comparisonsData || !comparisonsData.all_rows || comparisonsData.all_rows.length === 0) ? (
                    <ChartSkeleton />
                  ) : comparisonsData && comparisonsData.all_rows && comparisonsData.all_rows.length > 0 ? (
                    <div>
                      <ReactECharts option={trendChartOption} style={{ height: '380px' }} theme={darkMode ? 'dark' : 'light'} />
                      <div className="mt-2 p-2.5 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                        <p className="text-xs text-purple-700 dark:text-purple-400 flex items-start gap-2">
                          <span className="inline-block mt-0.5">💡</span>
                          <span>
                            <strong>交互提示：</strong>
                            点击图例开关曲线 | 滚轮缩放 | 框选放大 | 拖拽平移 | 工具栏保存或还原
                          </span>
                        </p>
                      </div>
                    </div>
                  ) : (
                    <EmptyState type="trend" />
                  )
                )}
              </div>
            </Card>
            
            <Card>
              <h2 className="text-lg md:text-xl font-semibold mb-3 flex items-center">
                <div className="p-1.5 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg mr-2">
                  <BrainCircuit size={16} className="text-white"/>
                </div>
                智能摘要
              </h2>
              {isProcessing && !analysisResult ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                  {[...Array(5)].map((_, i) => (
                    <StatCardSkeleton key={i} />
                  ))}
                </div>
              ) : analysisResult && analysisResult.comparison ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs md:text-sm text-gray-600 dark:text-gray-400">
                    <span className="inline-block w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                    <span className="font-medium">与上次分析对比</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                    {Object.entries(analysisResult.comparison).map(([key, data]) => {
                      const isIncrease = data.change > 0;
                      const bgGradient = isIncrease 
                        ? 'from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20' 
                        : 'from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20';
                      const iconColor = isIncrease ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400';
                      const label = key.replace('_ms', '').replace('p', 'P').toUpperCase();
                      const Icon = isIncrease ? TrendingUp : TrendingDown;
                      
                      return (
                        <div key={key} className={`bg-gradient-to-br ${bgGradient} p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-200`}>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="text-xs text-gray-600 dark:text-gray-400 font-bold tracking-wide">{label}</div>
                            <Icon size={14} className={iconColor} />
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-base md:text-lg font-bold text-gray-900 dark:text-gray-100">
                              {analysisResult.stats[key].toFixed(2)}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">ms</span>
                            <div className="mt-1 pt-1.5 border-t border-gray-200 dark:border-gray-700">
                              <span className={`text-xs font-bold ${iconColor}`}>
                                {isIncrease ? '+' : ''}{data.change.toFixed(1)}%
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
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
      </div>
    </div>
  );
}

export default App;

