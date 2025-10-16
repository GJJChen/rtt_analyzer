# 🎉 RTT Analyzer 打包完成！

## ✅ 已生成的文件

### 📦 发布包位置
```
D:\workspace\rtt_analyzer\rtt_analyzer\src-tauri\target\release\bundle\
```

### 📋 安装包

1. **NSIS 安装程序（推荐）**
   - `nsis/rtt_analyzer_0.1.0_x64-setup.exe`
   - 📝 说明：这是一个一体化安装程序，**后端已经内置**
   - 💡 优点：用户体验最佳，一键安装即可使用，无需单独启动后端

2. **MSI 安装包**
   - `msi/rtt_analyzer_0.1.0_x64_en-US.msi`
   - 📝 说明：Windows Installer 格式，**后端已经内置**
   - 💡 优点：适合企业环境部署

## 🎊 重大改进：后端已集成！

**现在用户只需要安装一个程序即可！**

- ✅ 后端服务器已打包进安装程序
- ✅ 应用启动时自动启动后端
- ✅ 应用关闭时自动停止后端
- ✅ 无需手动启动 `start_backend.bat`
- ✅ 无需安装 Python 环境

## 🚀 分发方式

### 方式 1：单文件分发（推荐）⭐

直接分发安装程序：
```
rtt_analyzer_0.1.0_x64-setup.exe
```

**就这么简单！**用户只需要：
1. 下载安装程序
2. 双击安装
3. 启动应用
4. 开始使用

**无需任何额外步骤！**后端会在后台自动运行。

### 方式 2：企业部署

使用 MSI 包通过组策略部署：
```
rtt_analyzer_0.1.0_x64_en-US.msi
```

## 📖 用户安装步骤

### 超级简单版（推荐）⭐

1. **安装应用程序**
   ```
   双击运行 "rtt_analyzer_0.1.0_x64-setup.exe"
   按照安装向导完成安装
   ```

2. **开始使用**
   ```
   从开始菜单启动 RTT Analyzer
   拖拽 CSV 文件开始分析
   ```

**仅此而已！** 后端会在后台自动运行，无需任何手动操作。

## 🔧 高级配置

### 后端配置

后端已经集成到应用中，默认配置：
- 监听地址: 127.0.0.1 (仅本地)
- 端口: 8000
- 自动启动: 是
- 自动停止: 是

如需修改配置，需要重新编译后端并打包。

### 查看后端日志

后端日志会输出到应用的控制台。如需查看：
1. 使用任务管理器查找 `rtt_analyzer_backend.exe` 进程
2. 或使用 Process Explorer 等工具

## 📊 文件大小参考

- NSIS 安装程序: ~30-40 MB (包含后端)
- MSI 安装包: ~30-40 MB (包含后端)
- 安装后占用空间: ~60-80 MB

## 🌐 分发渠道建议

1. **企业内部**: 使用 MSI 包通过组策略部署
2. **GitHub Release**: 上传 NSIS 安装程序
3. **网盘分享**: 分享 NSIS 安装程序
4. **直接分享**: 发送 NSIS 安装程序（单文件，超简单！）

## 🔒 安全说明

- ✅ 后端仅监听本地 127.0.0.1，不暴露到网络
- ✅ 无需管理员权限即可运行
- ✅ 所有数据处理在本地完成
- ✅ 不收集用户数据
- ✅ 后端进程随应用自动管理，不会驻留系统

## 📝 版本更新流程

下次更新版本时：

1. 修改版本号：
   - `rtt_analyzer\package.json`
   - `rtt_analyzer\src-tauri\Cargo.toml`  
   - `rtt_analyzer\src-tauri\tauri.conf.json`

2. 如果后端有更新，重新打包后端：
   ```bash
   cd D:\workspace\rtt_analyzer
   build_backend.bat
   ```

3. 复制后端到 Tauri bin 目录：
   ```bash
   Copy-Item "dist\rtt_analyzer_backend.exe" -Destination "rtt_analyzer\src-tauri\bin\rtt_analyzer_backend-x86_64-pc-windows-msvc.exe" -Force
   ```

4. 构建新版本：
   ```bash
   cd rtt_analyzer
   pnpm tauri build
   ```

5. 在 `src-tauri\target\release\bundle\` 找到新的安装包

## 🎯 测试清单

在分发前，请测试：

- [ ] 全新安装（在没有安装过的机器上）
- [ ] 应用启动（检查后端是否自动启动）
- [ ] 拖拽 CSV 文件
- [ ] 查看 CDF 图表
- [ ] 检查自动保存的 PNG 文件
- [ ] 切换深色/浅色主题
- [ ] 查看历史对比数据
- [ ] 关闭应用（检查后端进程是否自动停止）
- [ ] 卸载应用程序

## 💡 常见问题解决

### 用户报告"无法连接到服务器"

可能原因：
1. 后端启动失败 → 检查应用日志
2. 端口 8000 被占用 → 重启应用或重启电脑
3. 防火墙阻止 → 添加例外（虽然是本地连接，某些安全软件可能拦截）

### 后端进程检查

如需查看后端是否运行：
1. 打开任务管理器
2. 查找 `rtt_analyzer_backend.exe` 进程
3. 应该能看到它作为 `rtt_analyzer.exe` 的子进程

## 📞 技术支持

提供给用户的支持信息：
- 版本号: v0.1.0
- 构建日期: 2025-10-16
- 支持平台: Windows 10/11 (x64)
- 联系方式: [您的联系方式]

---

🎊 恭喜！您的应用已经准备好分发了！
