# 中文安装包发布指南

## 配置说明

已在 `tauri.conf.json` 中配置中文安装包：

```json
"bundle": {
  "windows": {
    "wix": {
      "language": "zh-CN"
    },
    "nsis": {
      "languages": ["SimpChinese"],
      "installerIcon": "icons/icon.ico",
      "displayLanguageSelector": false
    }
  }
}
```

## 构建中文安装包

### 1. 进入项目目录
```powershell
cd d:\Projects\rtt_analyzer\rtt_analyzer
```

### 2. 构建发布版本
```powershell
pnpm tauri build
```

### 3. 查找生成的安装包
构建完成后，安装包位于：
- **NSIS 安装包**（推荐）：`src-tauri\target\release\bundle\nsis\`
  - 文件名：`RTT Analyzer GUI_0.1.0_x64-setup.exe`
  - 特点：现代化界面，支持中文
  
- **MSI 安装包**：`src-tauri\target\release\bundle\msi\`
  - 文件名：`RTT Analyzer GUI_0.1.0_x64_zh-CN.msi`
  - 特点：企业部署友好

## 安装包说明

### NSIS 安装包特性
- ✅ 完整的简体中文界面
- ✅ 自定义安装位置
- ✅ 创建桌面快捷方式选项
- ✅ 开始菜单快捷方式
- ✅ 卸载程序
- ✅ 现代化安装向导

### MSI 安装包特性
- ✅ Windows Installer 标准格式
- ✅ 支持企业级部署（GPO）
- ✅ 支持静默安装：`msiexec /i "RTT Analyzer GUI_0.1.0_x64_zh-CN.msi" /quiet`
- ✅ 完整的安装/卸载日志

## 版本号修改

如需修改版本号，编辑 `src-tauri\tauri.conf.json`：

```json
{
  "productName": "RTT Analyzer GUI",
  "version": "0.1.0",  // 修改这里
  ...
}
```

同时修改 `src-tauri\Cargo.toml`：

```toml
[package]
name = "rtt_analyzer"
version = "0.1.0"  # 修改这里
```

## 发布检查清单

- [ ] 更新版本号
- [ ] 测试所有功能
- [ ] 检查图标显示正确
- [ ] 验证后端程序正常启动
- [ ] 测试文件拖放功能
- [ ] 检查暗色/亮色模式切换
- [ ] 验证图表交互（缩放、平移）
- [ ] 测试文件保存功能
- [ ] 确认窗口启动无闪烁
- [ ] 测试程序正常关闭（无残留进程）

## 发布步骤

1. **准备发布**
   ```powershell
   # 清理旧的构建
   Remove-Item -Recurse -Force .\src-tauri\target\release\bundle -ErrorAction SilentlyContinue
   
   # 构建新版本
   pnpm tauri build
   ```

2. **测试安装包**
   - 在干净的 Windows 系统上测试安装
   - 验证所有功能正常
   - 测试卸载程序

3. **创建发布包**
   ```powershell
   # 创建发布文件夹
   $version = "0.1.0"
   $releaseDir = "release\v$version"
   New-Item -ItemType Directory -Force -Path $releaseDir
   
   # 复制安装包
   Copy-Item "src-tauri\target\release\bundle\nsis\RTT Analyzer GUI_${version}_x64-setup.exe" $releaseDir
   Copy-Item "src-tauri\target\release\bundle\msi\RTT Analyzer GUI_${version}_x64_zh-CN.msi" $releaseDir
   
   # 复制文档
   Copy-Item "USER_MANUAL.txt" $releaseDir
   Copy-Item "README.md" $releaseDir
   ```

4. **计算校验和**
   ```powershell
   Get-FileHash "$releaseDir\*.exe" -Algorithm SHA256 | Format-List
   Get-FileHash "$releaseDir\*.msi" -Algorithm SHA256 | Format-List
   ```

## 分发说明

### 推荐：NSIS 安装包
- **文件大小**：约 42 MB
- **适用场景**：普通用户、直接下载安装
- **优点**：界面友好，安装体验好

### 企业：MSI 安装包
- **文件大小**：约 43 MB
- **适用场景**：企业批量部署、IT 管理员
- **优点**：标准化、可静默安装、便于管理

## 用户系统要求

- **操作系统**：Windows 10/11 (64位)
- **内存**：建议 4GB 以上
- **磁盘空间**：100 MB 以上
- **.NET Runtime**：不需要（自包含）
- **Python**：不需要（内嵌后端）

## 更新说明

用户可以：
1. 直接安装新版本（自动覆盖）
2. 或先卸载旧版本再安装新版本

安装程序会自动处理文件更新。

## 故障排查

### 安装失败
- 检查是否有足够的磁盘空间
- 确认以管理员权限运行安装程序
- 关闭杀毒软件重试

### 启动失败
- 检查后端程序是否被防火墙阻止
- 查看日志文件（在安装目录）
- 尝试以管理员权限运行

### 卸载残留
如果卸载后仍有残留：
```powershell
# 手动清理（谨慎操作）
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\com.rtt.analyzer"
Remove-Item -Recurse -Force "$env:APPDATA\com.rtt.analyzer"
```

## 技术支持

如遇问题，请提供：
- Windows 版本
- 安装包类型（NSIS/MSI）
- 错误信息截图
- 日志文件内容
