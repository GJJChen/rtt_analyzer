# 图表保存功能问题修复

## 问题1：权限错误

### 错误信息
```
dialog.save not allowed. Permissions associated with this command: dialog:allow-save, dialog:default
```

### 原因
- Tauri 应用需要显式声明权限才能使用 `dialog.save` API
- 之前只添加了 `dialog:allow-open`，没有添加 `dialog:allow-save`

### 解决方案
在 `src-tauri/capabilities/default.json` 中添加权限：

```json
{
  "permissions": [
    "dialog:allow-open",
    "dialog:allow-save",  // 新增
    ...
  ]
}
```

## 问题2：趋势图表保存提示"没有可保存的图表"

### 原因
- 只有 CDF 图表有 `chartRef` 引用
- 趋势图表没有引用，无法获取 ECharts 实例
- `handleManualSaveChart` 函数只检查 CDF 图表

### 解决方案

#### 1. 添加趋势图表引用
```javascript
const chartRef = useRef(null); // CDF 图表
const trendChartRef = useRef(null); // 趋势图表（新增）
```

#### 2. 为趋势图表添加 ref
```jsx
<ReactECharts 
  ref={trendChartRef}  // 新增
  option={trendChartOption} 
  style={{ height: '380px' }} 
  theme={darkMode ? 'dark' : 'light'} 
/>
```

#### 3. 修改保存函数支持两个图表
```javascript
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
  
  // ... 保存逻辑
  const filePath = await save({
    defaultPath: `${baseName}_${chartType}_${timestamp}.png`,  // 文件名包含图表类型
    ...
  });
}, [activeTab, chartRef, trendChartRef, analysisResult, comparisonsData, darkMode, addToast]);
```

## 功能验证

### CDF 分析图表
1. 拖入 CSV 文件完成分析
2. 在 "CDF 分析" 标签页
3. 点击工具栏"保存为图片"按钮或右上角绿色"保存图表"按钮
4. ✅ 弹出文件保存对话框
5. ✅ 默认文件名：`文件名_cdf_时间戳.png`

### 趋势对比图表
1. 分析多个文件后，切换到 "趋势对比" 标签页
2. 点击工具栏"保存为图片"按钮或右上角绿色"保存图表"按钮
3. ✅ 弹出文件保存对话框
4. ✅ 默认文件名：`文件名_trend_时间戳.png`

## 保存按钮位置

每个图表标签页都有两个保存按钮：

1. **工具栏按钮**（图表内右上角）
   - 位置：还原按钮旁边
   - 图标：下载/保存图标
   - 功能：保存当前可见图表

2. **绿色保存按钮**（标签页右上角）
   - 位置：标签按钮右侧
   - 文字："保存图表"（大屏）或只显示图标（小屏）
   - 功能：与工具栏按钮相同

## 文件命名规则

保存的文件名格式：
```
{基础名称}_{图表类型}_{时间戳}.png
```

示例：
- `sample_rtt_cdf_2025-10-17T08-30-15.png`  // CDF 图表
- `sample_rtt_trend_2025-10-17T08-31-22.png`  // 趋势图表

## 注意事项

### 需要重启应用
修改了 `capabilities/default.json` 后，需要：
1. 停止开发服务器（Ctrl+C）
2. 重新运行 `pnpm tauri dev`
3. 或者重新构建 `pnpm tauri build`

### 表格标签页
- "数据对比" 标签页没有图表，不显示保存按钮
- 如果需要导出表格数据，可以使用右键菜单的"复制表格数据"功能

## 总结

✅ **添加了 `dialog:allow-save` 权限**
✅ **为趋势图表添加了引用**
✅ **保存函数支持两种图表**
✅ **智能识别当前活动标签页**
✅ **文件名包含图表类型标识**
✅ **两种保存方式都可用**

现在无论在 CDF 分析还是趋势对比标签页，点击任一保存按钮都能正常工作！
