# 目录配置窗格功能增强

## 新增功能

在目录配置窗格中，为"输入文件目录"和"输出结果目录"两个字段增加了以下功能：

### 1. 选择文件夹按钮（原有功能）
- **图标**: 📁 FolderOpen
- **颜色**: 蓝色渐变 (blue-600 → blue-500)
- **功能**: 打开系统文件夹选择对话框，允许用户选择目录
- **提示文字**: "选择文件夹"

### 2. 打开当前文件夹按钮（新增功能）
- **图标**: 🔍 FolderSearch
- **颜色**: 绿色渐变 (green-600 → green-500)
- **功能**: 在文件资源管理器中打开当前选择的目录
- **提示文字**: "打开当前文件夹"
- **状态管理**:
  - 当目录未配置时，按钮显示为禁用状态（灰色）
  - 当目录已配置时，按钮可点击（绿色）
  - 点击时会使用系统默认文件管理器打开对应目录

## 实现细节

### 新增函数

#### `openInputDir()`
```javascript
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
```

#### `openOutputBaseDir()`
```javascript
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
```

### UI 更新

每个目录配置区域现在包含三个元素：
1. **输入框**: 显示和编辑目录路径
2. **选择按钮**: 蓝色，FolderOpen 图标
3. **打开按钮**: 绿色，FolderSearch 图标（当目录未配置时为灰色禁用状态）

### 依赖项

- 已导入 `FolderSearch` 图标从 `lucide-react`
- 使用 Tauri 的 `openPath` API（已从 `@tauri-apps/plugin-opener` 导入）

## 用户体验

### 输入文件目录
1. 用户可以点击蓝色按钮选择输入文件所在的目录
2. 选择后，可以点击绿色按钮快速在文件管理器中打开该目录
3. 如果未选择目录就点击绿色按钮，会显示提示"请先选择输入目录"

### 输出结果目录
1. 用户可以点击蓝色按钮选择输出结果的根目录（可选）
2. 选择后，可以点击绿色按钮快速在文件管理器中打开该目录
3. 如果未选择目录就点击绿色按钮，会显示提示"请先选择输出目录"

## 错误处理

- 如果目录路径不存在或无法打开，会显示错误提示："打开目录失败: [错误信息]"
- 如果目录未配置，会显示警告提示："请先选择XX目录"

## 视觉反馈

- **未配置状态**: 打开按钮显示为灰色，鼠标悬停时显示为"不可点击"状态
- **已配置状态**: 打开按钮显示为绿色渐变，鼠标悬停时有阴影和颜色加深效果
- **点击反馈**: 按钮有 `active:scale-95` 效果，点击时会有轻微缩小
- **焦点状态**: 键盘导航时有聚焦环效果

## 兼容性

- 适配暗黑模式：按钮和文本颜色在暗黑模式下自动调整
- 响应式设计：按钮大小在不同屏幕尺寸下保持一致
