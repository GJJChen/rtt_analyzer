# 生产环境调试指南

## 问题：安装后软件无法启动，卡在启动界面

### 原因分析
Onedir 模式下，后端由 1449 个文件组成，Tauri 需要正确定位这些文件。安装后的文件路径可能与开发环境不同。

### 调试步骤

#### 1. 查看日志文件
安装并运行软件后，在以下位置查找 `rtt_analyzer.log` 文件：

```
C:\Program Files\RTT Analyzer GUI\rtt_analyzer.log
```

或者在软件安装目录下查找。

日志会显示：
- 后端搜索路径
- 是否找到后端可执行文件
- 启动错误信息

#### 2. 检查安装目录结构
正确的 NSIS 安装后目录结构应该是：

```
C:\Program Files\RTT Analyzer GUI\
├── rtt_analyzer.exe                          ← 主程序
├── rtt_analyzer.log                          ← 日志文件（运行后生成）
├── resources\                                ← 资源目录（Tauri 标准位置）
│   └── rtt_analyzer_backend-x86_64-pc-windows-msvc\
│       ├── rtt_analyzer_backend-x86_64-pc-windows-msvc.exe
│       ├── _internal\
│       │   ├── python313.dll
│       │   └── ... (其他 Python 依赖)
│       └── base_library.zip
```

或者：

```
C:\Program Files\RTT Analyzer GUI\
├── rtt_analyzer.exe
├── rtt_analyzer.log
└── rtt_analyzer_backend-x86_64-pc-windows-msvc\    ← 后端目录（与主程序同级）
    ├── rtt_analyzer_backend-x86_64-pc-windows-msvc.exe
    ├── _internal\
    └── ...
```

#### 3. 手动测试后端
在命令行中尝试手动启动后端：

```powershell
cd "C:\Program Files\RTT Analyzer GUI\resources\rtt_analyzer_backend-x86_64-pc-windows-msvc"
.\rtt_analyzer_backend-x86_64-pc-windows-msvc.exe
```

如果显示 `INFO: Started server process`，说明后端本身没问题，是路径查找的问题。

#### 4. 检查 Tauri 配置
确认 `tauri.conf.json` 中的 resources 配置正确：

```json
"resources": {
  "bin/rtt_analyzer_backend-x86_64-pc-windows-msvc/**/*": "./"
}
```

这会将后端目录复制到安装包的 `resources/` 目录下。

### 已实现的修复

1. **多路径搜索**：代码会尝试以下位置：
   - `{resource_dir}/rtt_analyzer_backend-x86_64-pc-windows-msvc/`
   - `{exe_dir}/rtt_analyzer_backend-x86_64-pc-windows-msvc/`
   - `{exe_dir}/resources/rtt_analyzer_backend-x86_64-pc-windows-msvc/`

2. **详细日志**：所有路径检查都会写入日志文件

3. **工作目录设置**：使用 `current_dir()` 确保 Python 能找到 `_internal/` 目录

### 临时解决方案（如果安装失败）

使用 portable 版本（绿色版）：

```powershell
# 1. 解压 release 包到任意目录
# 2. 确保目录结构正确
# 3. 直接运行 rtt_analyzer.exe
```

### 重新构建步骤

```powershell
# 1. 构建后端
.\build_backend.ps1

# 2. 检查输出
Get-ChildItem rtt_analyzer\src-tauri\bin\rtt_analyzer_backend-x86_64-pc-windows-msvc

# 3. 构建 Tauri 应用
cd rtt_analyzer
pnpm tauri build

# 4. 测试安装包
cd src-tauri\target\release\bundle\nsis
.\RTT Analyzer GUI_0.1.0_x64-setup.exe
```

### 常见问题

**Q: 为什么 F12 无法打开控制台？**
A: 生产构建默认禁用开发者工具。已添加日志文件功能来替代。

**Q: 为什么 MSI 无法构建？**
A: WiX 工具无法处理 1449 个文件，已改为只构建 NSIS。

**Q: 启动时间还是很慢？**
A: 确保是 onedir 模式，不是 onefile。检查 `rtt_analyzer_backend.spec` 中的 `exclude_binaries=True`。

### 下一步优化建议

如果日志显示路径问题，可以考虑：

1. **使用 sidecar 的替代方案**：将后端打包为 Windows 服务
2. **简化部署**：回退到 onefile 模式（牺牲启动速度）
3. **自定义安装程序**：使用 InnoSetup 替代 NSIS，更灵活的文件部署控制
