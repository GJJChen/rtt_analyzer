use tauri::{Manager, AppHandle, RunEvent};
use tauri_plugin_shell::ShellExt;
use std::sync::{Arc, Mutex};

// 存储后端进程的 PID
struct BackendProcess(Arc<Mutex<Option<u32>>>);

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// 启动后端服务器
fn start_backend(app: &AppHandle) -> Result<u32, String> {
    let sidecar = app.shell()
        .sidecar("rtt_analyzer_backend")
        .map_err(|e| format!("Failed to create sidecar: {}", e))?;
    
    let (mut rx, child) = sidecar
        .spawn()
        .map_err(|e| format!("Failed to spawn backend: {}", e))?;

    let pid = child.pid();
    
    // 在后台监听输出
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                tauri_plugin_shell::process::CommandEvent::Stdout(line) => {
                    println!("[Backend] {}", String::from_utf8_lossy(&line));
                }
                tauri_plugin_shell::process::CommandEvent::Stderr(line) => {
                    // 只打印真正的错误信息，忽略 uvicorn 的 INFO 日志
                    let line_str = String::from_utf8_lossy(&line);
                    if !line_str.contains("INFO:") && !line_str.contains("Started server") {
                        eprintln!("[Backend Error] {}", line_str);
                    }
                }
                tauri_plugin_shell::process::CommandEvent::Terminated(status) => {
                    println!("[Backend] Process terminated with status: {:?}", status);
                    break;
                }
                _ => {}
            }
        }
    });

    Ok(pid)
}

// 终止后端进程的辅助函数
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .manage(BackendProcess(Arc::new(Mutex::new(None))))
        .setup(|app| {
            // 显式设置窗口图标
            #[cfg(target_os = "windows")]
            {
                use tauri::Manager;
                if let Some(window) = app.get_webview_window("main") {
                    // 图标会从 tauri.conf.json 中配置的路径加载
                    let _ = window.set_title("RTT Analyzer");
                }
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
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                // 窗口关闭时，终止后端进程
                if let Some(state) = window.try_state::<BackendProcess>() {
                    if let Some(pid) = *state.0.lock().unwrap() {
                        kill_backend(pid);
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![greet])
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
}
