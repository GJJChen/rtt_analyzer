# RTT Analyzer 发布指南

## 📦 发布包内容

### 方案 1：完整发布包（推荐给最终用户）

创建一个文件夹包含以下内容：

```
RTT_Analyzer_v0.1.0/
├── rtt_analyzer_0.1.0_x64-setup.exe     # 前端安装程序
├── rtt_analyzer_backend.exe             # 后端服务器（需要用 PyInstaller 打包）
├── start_backend.bat                     # 启动后端的批处理脚本
└── README.txt                            # 使用说明
```

### 方案 2：开发者版本（需要 Python 环境）

```
RTT_Analyzer_v0.1.0/
├── rtt_analyzer_0.1.0_x64-setup.exe     # 前端安装程序
├── rtt_analyzer_backend.py              # 后端源码
├── requirements.txt                      # Python 依赖
└── README.txt                            # 使用说明
```

## 🔧 打包步骤

### 1. 打包后端（如果选择方案 1）

运行打包脚本：
```bash
cd D:\workspace\rtt_analyzer
build_backend.bat
```

打包后的文件在：`dist\rtt_analyzer_backend.exe`

### 2. 前端安装包

已经生成在：
- `D:\workspace\rtt_analyzer\rtt_analyzer\src-tauri\target\release\bundle\nsis\rtt_analyzer_0.1.0_x64-setup.exe`
- `D:\workspace\rtt_analyzer\rtt_analyzer\src-tauri\target\release\bundle\msi\rtt_analyzer_0.1.0_x64_en-US.msi`

### 3. 创建启动脚本

创建 `start_backend.bat`：
```batch
@echo off
echo Starting RTT Analyzer Backend Server...
start "" "rtt_analyzer_backend.exe"
echo Backend server is running on http://127.0.0.1:8000
echo.
echo You can now start the RTT Analyzer application.
pause
```

### 4. 创建用户说明

创建 `README.txt`：
```
RTT Analyzer v0.1.0
====================

使用步骤：

1. 首先双击运行 "start_backend.bat" 启动后端服务器
   （等待看到 "Uvicorn running on http://127.0.0.1:8000" 消息）

2. 运行 RTT Analyzer 应用程序
   （如果是首次使用，请先运行安装程序 rtt_analyzer_0.1.0_x64-setup.exe）

3. 在应用程序中拖拽 CSV 文件到指定区域进行分析

4. 查看分析结果：
   - CDF 分析图表会自动保存到结果文件夹
   - 统计数据保存在 comparisons.csv
   - 历史对比和趋势分析在相应标签页查看

注意事项：
- 确保后端服务器一直运行
- 关闭应用后可以在任务管理器中结束后端进程
- CSV 文件应包含 RTT 数据列

技术支持：
如有问题请联系开发者
```

## 📋 依赖文件

### requirements.txt
```
fastapi>=0.104.0
uvicorn>=0.24.0
pandas>=2.1.0
numpy>=1.24.0
pydantic>=2.0.0
```

## 🎯 分发清单

创建发布包时，请确保包含：

- [ ] 前端安装程序（.exe 或 .msi）
- [ ] 后端可执行文件或 Python 脚本
- [ ] 启动脚本（start_backend.bat）
- [ ] 用户说明（README.txt）
- [ ] （可选）Python 依赖列表（requirements.txt）

## 💡 高级：创建自动启动

如果想让后端自动启动，可以：

1. 在 Tauri 配置中添加 shell 插件
2. 在应用启动时自动启动后端进程
3. 在应用关闭时自动停止后端进程

## 🔒 安全注意事项

- 后端默认只监听本地 127.0.0.1
- 不要暴露后端端口到公网
- 建议在生产环境中添加身份验证

## 📈 版本更新

更新版本号的位置：
- `rtt_analyzer\package.json` - "version" 字段
- `rtt_analyzer\src-tauri\Cargo.toml` - "version" 字段
- `rtt_analyzer\src-tauri\tauri.conf.json` - "version" 字段

更新版本号后重新运行：
```bash
pnpm tauri build
```
