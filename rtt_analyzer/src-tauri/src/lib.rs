use tauri::{Manager, AppHandle, RunEvent};
use std::sync::{Arc, Mutex};
use std::fs::OpenOptions;
use std::io::Write;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

// Windows 常量，用于隐藏窗口
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

// 存储后端进程的 PID
struct BackendProcess(Arc<Mutex<Option<u32>>>);

// 写入日志到文件（用于调试生产环境问题）
fn log_to_file(message: &str) {
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let log_path = exe_dir.join("rtt_analyzer.log");
            if let Ok(mut file) = OpenOptions::new()
                .create(true)
                .append(true)
                .open(&log_path)
            {
                let timestamp = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs();
                let _ = writeln!(file, "[{}] {}", timestamp, message);
            }
        }
    }
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// 启动后端服务器
fn start_backend(_app: &AppHandle) -> Result<u32, String> {
    log_to_file("=== Starting backend server ===");
    
    use std::process::Command;
    
    let backend_dir_name = "rtt_analyzer_backend-x86_64-pc-windows-msvc";
    let backend_exe_name = "rtt_analyzer_backend-x86_64-pc-windows-msvc.exe";
    
    // 获取当前可执行文件的目录
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(|p| p.to_path_buf()))
        .ok_or_else(|| "Failed to get executable directory".to_string())?;
    
    log_to_file(&format!("Exe directory: {:?}", exe_dir));
    
    // 直接判断：生产环境固定在 bin/ 子目录，开发环境在同级目录
    // cfg!(debug_assertions) 在编译时确定，零运行时开销
    let backend_dir = if cfg!(debug_assertions) {
        // 开发模式：target/debug/rtt_analyzer_backend-x86_64-pc-windows-msvc/
        log_to_file("Mode: Development");
        exe_dir.join(backend_dir_name)
    } else {
        // 生产模式：bin/rtt_analyzer_backend-x86_64-pc-windows-msvc/
        log_to_file("Mode: Production");
        exe_dir.join("bin").join(backend_dir_name)
    };
    
    let backend_exe = backend_dir.join(backend_exe_name);
    log_to_file(&format!("Backend path: {:?}", backend_exe));
    
    if !backend_exe.exists() {
        let error_msg = format!(
            "Backend not found at: {:?}\nPlease ensure backend is properly built and packaged.",
            backend_exe
        );
        log_to_file(&format!("ERROR: {}", error_msg));
        return Err(error_msg);
    }
    
    log_to_file("✓ Backend found");
    log_to_file(&format!("Working directory: {:?}", backend_dir));
    
    // 使用 Command 启动，设置工作目录为后端目录（重要！）
    let mut cmd = Command::new(&backend_exe);
    cmd.current_dir(&backend_dir);
    
    #[cfg(target_os = "windows")]
    {
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    
    let child = cmd.spawn()
        .map_err(|e| {
            let error_msg = format!("Failed to spawn backend process: {}\nBackend path: {:?}", e, backend_exe);
            log_to_file(&format!("ERROR: {}", error_msg));
            eprintln!("{}", error_msg);
            error_msg
        })?;
    
    let pid = child.id();
    let success_msg = format!("✓ Backend server started with PID: {}", pid);
    log_to_file(&success_msg);
    println!("{}", success_msg);
    
    Ok(pid)
}

// 清理可能残留的后端进程（静默版本，不显示窗口）
fn cleanup_existing_backend_silent() {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        
        // 使用 CREATE_NO_WINDOW 标志隐藏命令行窗口
        // 清理可能的两种进程名
        let _ = Command::new("taskkill")
            .args(&["/F", "/IM", "rtt_analyzer_backend-x86_64-pc-windows-msvc.exe"])
            .creation_flags(CREATE_NO_WINDOW)
            .output();
        let _ = Command::new("taskkill")
            .args(&["/F", "/IM", "rtt_analyzer_backend.exe"])
            .creation_flags(CREATE_NO_WINDOW)
            .output();
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        use std::process::Command;
        let _ = Command::new("pkill")
            .args(&["-9", "rtt_analyzer_backend"])
            .output();
    }
}

// 终止特定 PID 的后端进程（静默版本）
fn kill_backend_silent(pid: u32) {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        
        // 使用 taskkill 命令，添加 CREATE_NO_WINDOW 标志隐藏窗口
        let _ = Command::new("taskkill")
            .args(&["/F", "/PID", &pid.to_string()])
            .creation_flags(CREATE_NO_WINDOW)
            .output();
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        use std::process::Command;
        let _ = Command::new("kill")
            .args(&["-9", &pid.to_string()])
            .output();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .manage(BackendProcess(Arc::new(Mutex::new(None))))
        .setup(|app| {
            // 获取主窗口
            let window = app.get_webview_window("main").unwrap();
            
            // 显式设置窗口图标
            #[cfg(target_os = "windows")]
            {
                // 图标会从 tauri.conf.json 中配置的路径加载
                let _ = window.set_title("RTT Analyzer");
            }
            
            // 启动后端服务器
            match start_backend(app.handle()) {
                Ok(pid) => {
                    println!("Backend server started with PID: {}", pid);
                    let state = app.state::<BackendProcess>();
                    *state.0.lock().unwrap() = Some(pid);
                }
                Err(e) => {
                    eprintln!("Failed to start backend: {}", e);
                    
                    // 如果启动失败，可能是端口被占用，尝试清理后重试
                    if e.contains("Failed to spawn") || e.contains("Address already in use") {
                        eprintln!("Attempting to cleanup and retry...");
                        cleanup_existing_backend_silent();
                        std::thread::sleep(std::time::Duration::from_millis(500));
                        
                        // 重试一次
                        match start_backend(app.handle()) {
                            Ok(pid) => {
                                println!("Backend server started on retry with PID: {}", pid);
                                let state = app.state::<BackendProcess>();
                                *state.0.lock().unwrap() = Some(pid);
                            }
                            Err(retry_err) => {
                                eprintln!("Failed to start backend after retry: {}", retry_err);
                            }
                        }
                    }
                }
            }
            
            // 等待一小段时间让后端启动，然后显示窗口
            let window_clone = window.clone();
            tauri::async_runtime::spawn(async move {
                std::thread::sleep(std::time::Duration::from_millis(200));
                let _ = window_clone.show();
                let _ = window_clone.set_focus();
            });
            
            Ok(())
        })
        .on_window_event(|window, event| {
            match event {
                tauri::WindowEvent::CloseRequested { .. } => {
                    // 窗口关闭时，在后台线程中静默清理后端进程
                    if let Some(state) = window.try_state::<BackendProcess>() {
                        if let Some(pid) = *state.0.lock().unwrap() {
                            // 在后台线程中清理，不阻塞 UI
                            std::thread::spawn(move || {
                                kill_backend_silent(pid);
                                cleanup_existing_backend_silent();
                            });
                        }
                    }
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![greet])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, event| {
            // 应用退出时确保清理后端进程
            if let RunEvent::Exit = event {
                // 最终清理，使用静默模式
                cleanup_existing_backend_silent();
            }
        });
}
