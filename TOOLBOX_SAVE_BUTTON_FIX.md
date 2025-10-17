# 工具栏"保存为图片"按钮修复说明

## 问题
ECharts 工具栏中的"保存为图片"按钮在 Tauri 桌面应用中点击无反应。

## 原因
- ECharts 的 `saveAsImage` 功能依赖浏览器的下载 API
- 在 Tauri 应用中，浏览器环境受限，下载功能被阻止

## 解决方案

### 修改内容
1. **隐藏默认的 saveAsImage 按钮**
   ```javascript
   saveAsImage: {
     show: false
   }
   ```

2. **添加自定义按钮 mySaveImage**
   ```javascript
   mySaveImage: {
     show: true,
     title: '保存为图片',
     icon: 'path://M4.7,22.9L29.3,45.5L54.7,23.9M4.6,43.6L4.6,58L53.8,58L53.8,43.6M29.2,45.1L29.2,0',
     onclick: function() {
       const event = new CustomEvent('saveChartImage');
       window.dispatchEvent(event);
     }
   }
   ```

3. **监听自定义事件**
   ```javascript
   useEffect(() => {
     const handleSaveChartEvent = () => {
       handleManualSaveChart();
     };
     
     window.addEventListener('saveChartImage', handleSaveChartEvent);
     
     return () => {
       window.removeEventListener('saveChartImage', handleSaveChartEvent);
     };
   }, [handleManualSaveChart]);
   ```

### 工作流程
1. 用户点击工具栏的"保存为图片"按钮
2. 触发自定义的 `onclick` 事件
3. 发送 `saveChartImage` 自定义事件
4. React 组件监听到事件
5. 调用 `handleManualSaveChart()` 函数
6. 弹出 Tauri 文件保存对话框
7. 保存高质量 PNG 图片

## 效果

### 外观
- **位置**：工具栏最右边（还原按钮旁边）
- **图标**：下载/保存图标（与原来相同）
- **标题**：鼠标悬停显示"保存为图片"

### 功能
- ✅ 点击后立即弹出文件保存对话框
- ✅ 可以选择保存位置和文件名
- ✅ 自动生成带时间戳的默认文件名
- ✅ 保存为高清 PNG（2x 像素密度）
- ✅ 自动适配亮色/暗色背景
- ✅ 保存的图片不包含工具栏和缩放控件
- ✅ 保存成功后显示提示消息

### 与原按钮的区别

| 特性 | 原 saveAsImage | 新 mySaveImage |
|------|---------------|---------------|
| **外观** | 下载图标 | 下载图标（相同） |
| **Tauri 兼容** | ❌ 不工作 | ✅ 完全支持 |
| **保存位置** | 默认下载文件夹 | 用户自选 |
| **文件名** | 固定名称 | 带时间戳，可自定义 |
| **成功提示** | 无 | Toast 消息 |
| **错误处理** | 无 | 完整的错误提示 |

## 测试

启动应用后：
1. 拖入 CSV 文件进行分析
2. 在 CDF 分析或趋势对比标签页
3. 点击工具栏右上角的"保存为图片"按钮
4. 应该弹出文件保存对话框
5. 选择位置并保存
6. 看到"图表已保存"的成功提示

## 技术细节

### 为什么使用自定义事件？
- ECharts 的 `onclick` 回调在不同上下文中执行
- 无法直接访问 React 组件的函数和状态
- 使用 DOM 事件桥接 ECharts 和 React

### 图标路径
```
path://M4.7,22.9L29.3,45.5L54.7,23.9M4.6,43.6L4.6,58L53.8,58L53.8,43.6M29.2,45.1L29.2,0
```
这是一个下载图标的 SVG 路径，与 ECharts 默认的保存图标相同。

### 应用范围
- ✅ CDF 分析图表
- ✅ 趋势对比图表
- 两个图表都使用相同的保存函数

## 其他保存方式

除了工具栏按钮，还有以下保存方式：

1. **标签页右上角的绿色按钮**（新增）
   - 位置更明显
   - 功能完全相同

2. **自动保存**
   - 分析完成后自动保存到结果文件夹
   - 无需手动操作

三种方式提供了灵活的选择，满足不同用户习惯。

## 总结

✅ **工具栏"保存为图片"按钮现在可以正常工作**
✅ **使用 Tauri 原生文件对话框**
✅ **保持原有的外观和位置**
✅ **功能更强大、更可靠**
