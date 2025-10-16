# 后端进程自动清理修复

## 问题描述
在开发模式下，关闭前端应用后，后端进程 `rtt_analyzer_backend.exe` 没有自动退出，导致：
- 端口 8000 被占用
- 下次启动时出现端口冲突
- 需要手动使用任务管理器终止进程

## 原因分析
原有代码只在 `on_window_event` 的 `CloseRequested` 事件中尝试清理后端进程，但在某些情况下（如开发模式强制退出），这个事件可能不会被触发。

## 解决方案

### 1. 改进的进程清理机制

**修改文件**: `rtt_analyzer\src-tauri\src\lib.rs`

#### 主要改动：

1. **添加 `RunEvent` 导入**
   ```rust
   use tauri::{Manager, AppHandle, RunEvent};
   ```

2. **添加专门的清理函数**
   ```rust
   fn kill_backend(pid: u32) {
       #[cfg(target_os = "windows")]
       {
           use std::process::Command;
           println!("Attempting to kill backend process with PID: {}", pid);
           let _ = Command::new("taskkill")
               .args(&["/PID", &pid.to_string(), "/F"])
               .output();
       }
       
       #[cfg(not(target_os = "windows"))]
       {
           use std::process::Command;
           println!("Attempting to kill backend process with PID: {}", pid);
           let _ = Command::new("kill")
               .args(&["-9", &pid.to_string()])
               .output();
       }
   }
   ```

3. **双重保护机制**
   - **窗口关闭事件**（`on_window_event`）- 用户点击关闭按钮时触发
   - **应用退出事件**（`RunEvent::ExitRequested`）- 应用完全退出时触发
   
   ```rust
   .build(tauri::generate_context!())
   .expect("error while building tauri application")
   .run(|app_handle, event| {
       // 应用退出时确保清理后端进程
       if let RunEvent::ExitRequested { .. } = event {
           if let Some(state) = app_handle.try_state::<BackendProcess>() {
               if let Some(pid) = *state.0.lock().unwrap() {
                   kill_backend(pid);
               }
           }
       }
   });
   ```

### 2. 测试工具

创建了 `test_backend_cleanup.ps1` 脚本用于：
- 检查是否有残留的后端进程
- 批量清理残留进程
- 验证修复效果

使用方法：
```powershell
.\test_backend_cleanup.ps1
```

## 验证步骤

1. **启动应用**
   ```powershell
   cd rtt_analyzer
   pnpm tauri dev
   ```

2. **检查后端进程**
   ```powershell
   Get-Process | Where-Object {$_.ProcessName -eq 'rtt_analyzer_backend'}
   ```
   应该看到一个进程在运行

3. **关闭应用**
   - 点击窗口关闭按钮，或
   - 在终端按 Ctrl+C

4. **再次检查进程**
   ```powershell
   Get-Process | Where-Object {$_.ProcessName -eq 'rtt_analyzer_backend'}
   ```
   应该没有进程了（修复成功！）

## 清理残留进程

如果发现有残留进程，使用以下命令清理：

```powershell
# 方法1：使用测试脚本
.\test_backend_cleanup.ps1

# 方法2：手动清理
Get-Process | Where-Object {$_.ProcessName -eq 'rtt_analyzer_backend'} | Stop-Process -Force

# 方法3：使用 taskkill
taskkill /IM rtt_analyzer_backend.exe /F
```

## 跨平台支持

代码已添加跨平台支持：
- **Windows**: 使用 `taskkill /PID <pid> /F`
- **Linux/macOS**: 使用 `kill -9 <pid>`

## 注意事项

1. **开发模式**：修改后需要重新编译 Rust 代码
   ```powershell
   cd rtt_analyzer
   pnpm tauri dev
   ```

2. **生产模式**：需要重新构建应用
   ```powershell
   cd rtt_analyzer
   pnpm tauri build
   ```

3. **端口占用**：如果仍然遇到端口占用，先运行清理脚本

## 技术细节

### 为什么需要双重保护？

| 事件类型 | 触发时机 | 覆盖场景 |
|---------|---------|---------|
| `CloseRequested` | 用户点击关闭按钮 | 正常退出 |
| `ExitRequested` | 应用程序退出 | 强制退出、崩溃、开发模式热重载 |

两者结合可以确保在各种退出场景下都能正确清理后端进程。

### Arc<Mutex<Option<u32>>>

使用 `Arc` (原子引用计数) 是为了在不同的事件处理器之间安全地共享 PID 状态。

## 相关文件

- `rtt_analyzer\src-tauri\src\lib.rs` - 主要修改文件
- `test_backend_cleanup.ps1` - 测试和清理工具
- `BACKEND_CLEANUP.md` - 本文档

## 总结

✅ **已修复**：后端进程现在会在应用退出时自动清理  
✅ **跨平台**：支持 Windows、Linux、macOS  
✅ **双重保护**：两层事件确保可靠清理  
✅ **测试工具**：提供脚本验证和清理残留进程
