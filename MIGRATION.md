# Project Migration Guide (Windows)

This guide helps you move the RTT Analyzer project to a new Windows machine and get it running for development and build.

## 1. What to transfer

Transfer the whole repository folder `rtt_analyzer/` (the parent folder containing `rtt_analyzer/` frontend subfolder, `rtt_analyzer_backend.py`, batch files, etc.). Prefer Git (recommended) or a zip.

- Recommended: Push to Git and clone on the new PC
- Alternative: Create a zip at the old PC and unzip on the new PC

Optional: Copy historical data file for comparisons (user-specific)
- `%APPDATA%/RTT_Analyzer/comparisons.csv`

## 2. Prerequisites on the new PC

- Windows 10/11 x64
- PowerShell
- Python 3.12.x (64-bit) and pip
- Node.js 20+ and pnpm 9/10
- Rust toolchain (stable) and Visual Studio Build Tools (C++ for Desktop)

Quick installs (optional references):
- Python: https://www.python.org/downloads/
- Node: https://nodejs.org/ (then `npm i -g pnpm`)
- Rust: https://rustup.rs/
- VS Build Tools: https://visualstudio.microsoft.com/visual-cpp-build-tools/

## 3. Checkout / Unzip project

- Git: `git clone <your_repo_url>`
- Zip: unzip to a path without spaces (e.g. `D:\workspace\rtt_analyzer`)

## 4. Python environment (backend)

Open PowerShell in the repo root (where `rtt_analyzer_backend.py` lives):

```powershell
# Create venv
python -m venv .venv

# Activate
. .venv\Scripts\Activate.ps1

# Install backend deps
pip install -r requirements.txt

# Optional: run backend directly for a smoke test
python rtt_analyzer_backend.py
# Expect: Uvicorn running at http://127.0.0.1:8000
# Ctrl+C to stop
```

If you need the single-file EXE backend for Tauri sidecar (dev/build will copy your built exe):

```powershell
# Build backend exe
./build_backend.bat
# Output: dist\rtt_analyzer_backend.exe
```

## 5. Frontend/Tauri environment

```powershell
# Go to frontend folder
cd rtt_analyzer

# Install JS deps
pnpm install

# Dev run (Tauri)
pnpm tauri dev
```

If the exe is not yet copied to `src-tauri/bin/`, do it once (from repo root):

```powershell
Copy-Item -Path .\dist\rtt_analyzer_backend.exe -Destination .\rtt_analyzer\src-tauri\bin\rtt_analyzer_backend-x86_64-pc-windows-msvc.exe -Force
```

For a release build:

```powershell
cd rtt_analyzer
pnpm tauri build
```

Outputs: NSIS/MSI installers under `rtt_analyzer\src-tauri\target\release\bundle\`

## 6. Historical data (optional)

If you want to keep prior comparison/trend history, copy this file from the old PC to the new PC:

- From: `%APPDATA%\RTT_Analyzer\comparisons.csv` (old PC, per user)
- To:   `%APPDATA%\RTT_Analyzer\comparisons.csv` (new PC, per user)

The app will recreate the folder/file if missing.

## 7. Common issues

- Missing MSVC toolchain: install Visual Studio Build Tools (C++ for Desktop)
- Backend port in use (8000): kill stale processes or change port in `rtt_analyzer_backend.py`
- Permission denied when replacing exe: ensure app not running; stop via Task Manager or use `Stop-Process -Name rtt_analyzer_backend -Force`
- Webview2 not installed: usually auto-handled by Tauri; if not, install Microsoft Edge WebView2 runtime

## 8. One-shot bootstrap (optional)

You can add a bootstrap script to automate: venv creation, pip install, backend build+copy, `pnpm install`, and dev run.

Example steps to include in a future `scripts/bootstrap_dev.ps1`:
1. Create & activate venv
2. `pip install -r requirements.txt`
3. Build backend exe then copy to `src-tauri/bin/...`
4. `pnpm install`
5. `pnpm tauri dev`
