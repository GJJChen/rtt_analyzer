# 图表保存功能说明

## 当前实现

### 工具栏保存按钮
右上角工具栏中的"保存为图片"按钮使用的是 ECharts 内置的 `saveAsImage` 功能。

**工作原理：**
1. 点击按钮后，ECharts 会将图表渲染为 PNG 图片
2. 自动触发浏览器下载
3. 图片会保存到系统默认下载文件夹

**可能无反应的原因：**
- Tauri 应用中，浏览器的下载行为可能被限制
- 需要额外的文件系统权限配置

### 右键保存（浏览器原生）
您提到的"右键 → 将图像另存为"是浏览器的原生功能，在 Tauri 桌面应用中可能不可用。

## 解决方案

### 方案1：添加自定义保存功能（推荐）

使用 Tauri 的文件系统 API 实现保存：

```javascript
// 在 App.jsx 中添加
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';

// 自定义保存图表函数
const handleSaveChart = async () => {
  const chartInstance = chartRef.current?.getEchartsInstance();
  if (!chartInstance) return;
  
  try {
    // 获取图表的 base64 数据
    const base64 = chartInstance.getDataURL({
      type: 'png',
      pixelRatio: 2,
      backgroundColor: darkMode ? '#1f2937' : '#ffffff',
      excludeComponents: ['toolbox', 'dataZoom']
    });
    
    // 将 base64 转换为 Uint8Array
    const base64Data = base64.split(',')[1];
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // 打开保存对话框
    const filePath = await save({
      defaultPath: `RTT_CDF_${new Date().getTime()}.png`,
      filters: [{
        name: 'PNG图片',
        extensions: ['png']
      }]
    });
    
    if (filePath) {
      // 写入文件
      await writeFile(filePath, bytes);
      addToast('图表已保存', 'success');
    }
  } catch (error) {
    console.error('保存图表失败:', error);
    addToast('保存失败: ' + error.message, 'error');
  }
};
```

### 方案2：使用 ECharts 下载（需配置权限）

在 `tauri.conf.json` 中添加下载权限：

```json
{
  "app": {
    "security": {
      "csp": "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'"
    }
  },
  "bundle": {
    "resources": {
      "download": true
    }
  }
}
```

### 方案3：右键菜单保存（最简单）

为图表添加自定义右键菜单：

```javascript
<ReactECharts
  ref={chartRef}
  option={chartOption}
  style={{ height: '400px', width: '100%' }}
  onContextMenu={(e) => {
    e.preventDefault();
    // 显示保存选项
    handleSaveChart();
  }}
/>
```

## 当前建议

由于工具栏保存可能在 Tauri 中不工作，建议：

1. **临时解决方案**：使用浏览器的开发者工具
   - 按 F12 打开开发者工具
   - 在 Console 中运行：
     ```javascript
     const chart = document.querySelector('canvas').toDataURL();
     const a = document.createElement('a');
     a.href = chart;
     a.download = 'chart.png';
     a.click();
     ```

2. **长期解决方案**：实现方案1的自定义保存功能

## 自动保存功能

应用已经实现了自动保存功能，当分析完成时会自动保存图表到结果文件夹：

- 位置：`{输出目录}/{文件名}_results/`
- 文件名：`{文件名}_cdf_chart.png`

这个功能是可靠的，使用 Tauri 的文件系统 API。

## 下一步

我可以帮您实现方案1（自定义保存按钮），这样就可以可靠地手动保存图表了。需要我现在实现吗？
