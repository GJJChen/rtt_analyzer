# 更换应用图标指南

## 快速更换图标

如果你想使用项目根目录的 `favicon.ico` 作为应用图标，按照以下步骤操作：

### 方法 1：使用 Tauri 图标生成器（推荐）

1. **准备一个高质量的 PNG 图标**
   - 尺寸：至少 1024x1024 像素
   - 格式：PNG（透明背景更佳）
   - 图标应该是方形的

2. **如果你有 favicon.ico，先转换为 PNG：**
   - 访问：https://convertio.co/zh/ico-png/
   - 上传 `favicon.ico`
   - 下载转换后的 PNG 文件

3. **使用 Tauri 生成所有尺寸的图标：**
   ```bash
   cd rtt_analyzer
   pnpm tauri icon ../your-icon.png
   ```
   
   或者如果图标在根目录：
   ```bash
   cd rtt_analyzer
   pnpm tauri icon ../favicon.png
   ```

这会自动生成并替换 `src-tauri/icons/` 目录下的所有图标文件。

### 方法 2：手动替换（快速但不推荐）

1. **复制 ICO 文件：**
   ```bash
   copy ..\favicon.ico src-tauri\icons\icon.ico
   ```

2. **重新构建应用：**
   ```bash
   pnpm tauri build
   ```

**注意：** 这种方法可能导致某些平台上的图标显示不正确，因为不同平台需要不同尺寸的图标。

## 图标要求说明

Tauri 需要以下格式的图标：

### Windows
- `icon.ico` - 应用程序图标（推荐包含 16x16, 32x32, 48x48, 256x256）
- `32x32.png` - 小图标
- `128x128.png` - 中等图标
- `128x128@2x.png` - 高 DPI 显示屏

### macOS
- `icon.icns` - macOS 应用图标包

### Linux
- 各种尺寸的 PNG 文件

### Windows Store (UWP)
- `Square*Logo.png` 系列 - 各种尺寸的方形 Logo

## 推荐工作流程

1. **创建一个 1024x1024 的 PNG 主图标**
   
2. **使用 Tauri 生成所有尺寸：**
   ```bash
   cd rtt_analyzer
   pnpm tauri icon path/to/master-icon.png
   ```

3. **验证图标已更新：**
   ```bash
   # 检查 icons 目录
   dir src-tauri\icons
   ```

4. **重新构建应用：**
   ```bash
   pnpm tauri build
   ```

## 在线工具推荐

如果你只有 ICO 文件，可以使用以下在线工具转换：

- **ICO 转 PNG：** https://convertio.co/zh/ico-png/
- **PNG 调整尺寸：** https://www.iloveimg.com/zh-cn/resize-image
- **创建 ICNS (macOS)：** https://cloudconvert.com/png-to-icns

## 验证图标是否更新

构建完成后，检查生成的安装包：

```bash
# 安装包位置
rtt_analyzer\src-tauri\target\release\bundle\

# Windows
- msi\*.msi (查看安装程序图标)
- nsis\*.exe (查看安装程序图标)
```

右键点击 `.exe` 或 `.msi` 文件，查看属性中的图标是否已更新。

## 开发模式中的图标

在开发模式 (`pnpm tauri dev`) 中，窗口图标会自动使用 `src-tauri/icons/icon.ico`。

## 清除图标缓存（Windows）

如果更新图标后看不到变化，可能需要清除 Windows 图标缓存：

```powershell
# 以管理员身份运行 PowerShell
ie4uinit.exe -show
ie4uinit.exe -ClearIconCache
```

或者重启资源管理器：

```powershell
taskkill /f /im explorer.exe
start explorer.exe
```

## 故障排除

### 问题：图标没有更新
**解决方案：**
1. 确保图标文件格式正确（ICO 至少包含 32x32 尺寸）
2. 删除 `src-tauri\target` 目录后重新构建
3. 清除 Windows 图标缓存

### 问题：不同尺寸的图标显示不一致
**解决方案：**
使用 `pnpm tauri icon` 重新生成所有尺寸，确保视觉一致性。

### 问题：macOS 或 Linux 图标显示不正确
**解决方案：**
确保使用 Tauri 图标生成器，它会为所有平台生成正确的格式。
