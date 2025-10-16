# 自动构建配置说明

## 后端自动打包

### 方式 1：使用 Tauri 构建命令（推荐）
当你运行以下命令时，后端会自动打包：

```bash
cd rtt_analyzer
pnpm tauri build
```

这会自动执行：
1. 构建前端 (`pnpm build`)
2. 打包后端 (`build_backend.bat`)
3. 打包 Tauri 应用

### 方式 2：手动打包后端
如果只想打包后端，在项目根目录运行：

**Windows PowerShell:**
```powershell
.\build_backend.ps1
```

**Windows 命令提示符:**
```cmd
build_backend.bat
```

### 后端可执行文件位置
打包后的后端会自动复制到：
- `rtt_analyzer\src-tauri\bin\rtt_analyzer_backend-x86_64-pc-windows-msvc.exe`

这样 Tauri 打包时会自动包含后端可执行文件。

## 应用图标配置

### 图标文件位置
应用图标位于：`rtt_analyzer\src-tauri\icons\`

当前使用的图标文件：
- `icon.ico` - Windows 应用图标
- `icon.png` - 基础图标
- `32x32.png`, `128x128.png` 等 - 各种尺寸的图标

### 更换图标
如果要使用根目录的 `favicon.ico` 作为应用图标：

1. **手动方式：**
   - 将 `favicon.ico` 复制到 `rtt_analyzer\src-tauri\icons\icon.ico`
   - 使用在线工具将 `.ico` 转换为 `.png` 格式
   - 生成不同尺寸的 PNG 图标（32x32, 128x128 等）

2. **使用 Tauri 图标生成器（推荐）：**
   ```bash
   cd rtt_analyzer
   pnpm tauri icon path/to/your/icon.png
   ```
   
   这会自动生成所有需要的图标尺寸。

### 图标要求
- 源图标应该是 **1024x1024** 或更大的 PNG 文件
- 图标应该是方形的
- 背景最好是透明的

## 开发模式

在开发模式下运行：
```bash
cd rtt_analyzer
pnpm tauri dev
```

确保后端已经打包（运行过 `build_backend.bat` 或 `build_backend.ps1`）。

## 注意事项

1. **首次构建：** 第一次构建前，请手动运行一次 `build_backend.bat` 确保后端可执行文件存在。

2. **后端修改：** 如果修改了 `rtt_analyzer_backend.py`，需要重新运行构建脚本。

3. **依赖更新：** 如果后端添加了新的 Python 依赖，需要在虚拟环境中安装：
   ```bash
   .venv\Scripts\activate
   pip install <新依赖>
   ```
   然后重新打包。

4. **图标缓存：** 修改图标后，可能需要清除 Windows 图标缓存才能看到更新。
