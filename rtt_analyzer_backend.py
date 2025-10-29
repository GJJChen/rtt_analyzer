import pandas as pd
import numpy as np
import sys
import os
import shutil
import json
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
from pathlib import Path

# --- 获取应用数据目录 ---
def get_app_data_dir():
    """
    获取应用数据存储目录
    Windows: %APPDATA%/RTT_Analyzer
    """
    if sys.platform == "win32":
        app_data = os.getenv('APPDATA')
        app_dir = os.path.join(app_data, 'RTT_Analyzer')
    else:
        # Linux/Mac
        home = str(Path.home())
        app_dir = os.path.join(home, '.rtt_analyzer')
    
    os.makedirs(app_dir, exist_ok=True)
    return app_dir

# 全局比较数据文件路径
COMPARISONS_FILE = os.path.join(get_app_data_dir(), "comparisons.csv")

# 全局配置文件路径
CONFIG_FILE = os.path.join(get_app_data_dir(), "config.json")

# --- Pydantic Models for API Request ---
# Defines the structure of the incoming request body
class FileProcessRequest(BaseModel):
    file_path: str
    output_base_dir: str | None = None  # 接受 str 或 None

class ConfigData(BaseModel):
    input_dir: str = ""
    output_base_dir: str = ""

# --- FastAPI App Initialization ---
app = FastAPI(
    title="RTT Analyzer Backend API",
    description="Handles CSV file processing for the RTT Analyzer GUI.",
    version="1.0.0",
)

# --- CORS Middleware ---
# Allows the React frontend (running on a different port) to communicate with this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for simplicity in local development
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods (GET, POST, etc.)
    allow_headers=["*"],  # Allows all headers
)

# --- Health Check Endpoint ---
@app.get("/health")
async def health_check():
    """
    Simple health check endpoint to verify backend is ready.
    """
    return {"status": "ok", "message": "Backend is ready"}


# --- Core Data Processing Logic ---
# Refactored from the original script to be a callable function
def analyze_rtt_data(file_path: str, output_base_dir: str = None):
    """
    Analyzes a single RTT CSV file and returns structured data.
    Note: This function NO LONGER creates plots. It returns data for the frontend to plot.
    
    Args:
        file_path: Path to the CSV file
        output_base_dir: Optional custom output directory. If None or empty, uses the file's directory.
    """
    try:
        # --- 1. Define Paths ---
        base_name = os.path.splitext(os.path.basename(file_path))[0]
        
        # 使用自定义输出根目录或文件所在目录
        if output_base_dir and output_base_dir.strip() and os.path.isdir(output_base_dir):
            output_base = output_base_dir
        else:
            output_base = os.path.dirname(file_path)
        
        output_dir = os.path.join(output_base, f"{base_name}_results")
        os.makedirs(output_dir, exist_ok=True)

        # --- 2. Read Data ---
        df = pd.read_csv(file_path, encoding='utf-8', usecols=['RTT'])
        valid = df["RTT"].dropna() * 1e3

        # --- 3. Copy Original File (keep the original) ---
        dest_path = os.path.join(output_dir, os.path.basename(file_path))
        if not os.path.exists(dest_path):
            shutil.copy2(file_path, dest_path)

        if valid.empty:
            raise ValueError(f"File '{os.path.basename(file_path)}' contains no valid RTT data.")

        valid_sorted = valid.sort_values(ascending=True).reset_index(drop=True)

        # --- 4. Calculate Statistics ---
        stats = {
            "mean_ms": np.mean(valid_sorted),
            "p50_ms": np.percentile(valid_sorted, 50),
            "p90_ms": np.percentile(valid_sorted, 90),
            "p99_ms": np.percentile(valid_sorted, 99),
            "p999_ms": np.percentile(valid_sorted, 99.9),
            "samples_ok": len(valid_sorted),
        }

        # --- 5. Save to comparisons.csv ---
        comparison_csv_path = COMPARISONS_FILE  # 使用全局路径
        timestamp = datetime.now().strftime("%m/%d %H:%M")
        header = "timestamp,source_file,mean_ms,p50_ms,p90_ms,p99_ms,p999_ms\n"
        file_exists = os.path.exists(comparison_csv_path)

        # 读取上一次的数据用于对比
        comparison_data = None
        if file_exists:
            try:
                df_comparison = pd.read_csv(
                    comparison_csv_path, 
                    encoding='utf-8', 
                    na_values=['', ' '], 
                    keep_default_na=True,
                    dtype={'source_file': str}
                )
                # 过滤空行
                df_comparison = df_comparison.dropna(how='all')
                
                # 检查是否有有效数据行（不仅仅是列名）
                if len(df_comparison) > 0 and not df_comparison.empty:
                    last_row = df_comparison.iloc[-1]
                    
                    def safe_change_percent(current, previous):
                        """安全计算百分比变化，避免NaN和Inf"""
                        if pd.isna(previous) or pd.isna(current) or previous == 0:
                            return 0.0
                        change = ((current - previous) / previous * 100)
                        if np.isnan(change) or np.isinf(change):
                            return 0.0
                        return change
                    
                    comparison_data = {
                        "mean_ms": {"value": float(last_row['mean_ms']) if pd.notna(last_row['mean_ms']) else 0.0, "change": safe_change_percent(stats['mean_ms'], last_row['mean_ms'])},
                        "p50_ms": {"value": float(last_row['p50_ms']) if pd.notna(last_row['p50_ms']) else 0.0, "change": safe_change_percent(stats['p50_ms'], last_row['p50_ms'])},
                        "p90_ms": {"value": float(last_row['p90_ms']) if pd.notna(last_row['p90_ms']) else 0.0, "change": safe_change_percent(stats['p90_ms'], last_row['p90_ms'])},
                        "p99_ms": {"value": float(last_row['p99_ms']) if pd.notna(last_row['p99_ms']) else 0.0, "change": safe_change_percent(stats['p99_ms'], last_row['p99_ms'])},
                        "p999_ms": {"value": float(last_row['p999_ms']) if pd.notna(last_row['p999_ms']) else 0.0, "change": safe_change_percent(stats['p999_ms'], last_row['p999_ms'])},
                    }
            except Exception as e:
                print(f"Warning: Could not read comparison data: {e}")

        # 使用pandas写入CSV，避免手动管理表头和追加模式的问题
        new_row_df = pd.DataFrame([{
            'timestamp': timestamp,
            'source_file': base_name,
            'mean_ms': round(stats['mean_ms'], 2),
            'p50_ms': round(stats['p50_ms'], 2),
            'p90_ms': round(stats['p90_ms'], 2),
            'p99_ms': round(stats['p99_ms'], 2),
            'p999_ms': round(stats['p999_ms'], 2)
        }])
        
        if file_exists:
            # 读取现有数据并追加新行
            try:
                existing_df = pd.read_csv(
                    comparison_csv_path, 
                    encoding='utf-8', 
                    na_values=['', ' '], 
                    keep_default_na=True,
                    dtype={'source_file': str}
                )
                
                # 过滤掉完全空的行和所有数据列都为空的行
                existing_df = existing_df.dropna(how='all')
                # 进一步过滤：如果数据列（mean_ms等）全为空，也删除
                data_columns = ['mean_ms', 'p50_ms', 'p90_ms', 'p99_ms', 'p999_ms']
                existing_df = existing_df.dropna(subset=data_columns, how='all')
                
                if len(existing_df) > 0:
                    updated_df = pd.concat([existing_df, new_row_df], ignore_index=True)
                else:
                    updated_df = new_row_df
            except (pd.errors.EmptyDataError, Exception) as e:
                # 文件存在但为空、只有表头或读取失败
                print(f"Warning: Could not read existing comparison data: {e}")
                updated_df = new_row_df
        else:
            updated_df = new_row_df
        
        # 写入更新后的数据
        updated_df.to_csv(comparison_csv_path, index=False, encoding='utf-8')

        # --- 6. Prepare Chart Data for Frontend ---
        rtt = valid_sorted.to_numpy()
        n = len(rtt)
        x = np.sort(rtt).tolist()
        y = (np.arange(1, n + 1) / n).tolist()

        return {
            "stats": stats,
            "chart_data": {"x": x, "y": y},
            "output_dir": output_dir,
            "comparison_file": comparison_csv_path,
            "base_name": base_name,
            "comparison": comparison_data,
        }

    except FileNotFoundError:
        raise FileNotFoundError(f"The file was not found at path: {file_path}")
    except Exception as e:
        # Re-raise other exceptions to be caught by the API endpoint
        raise e


# --- API Endpoint ---
@app.post("/process-file")
async def process_file_endpoint(request: FileProcessRequest):
    """
    API endpoint to process a single CSV file.
    Receives a file path, calls the analysis function, and returns the results.
    """
    try:
        print(f"Received request to process file: {request.file_path}")
        result = analyze_rtt_data(request.file_path, request.output_base_dir)
        print(f"Successfully processed {result['base_name']}")
        return {
            "status": "success",
            "message": f"File '{result['base_name']}' processed successfully.",
            "data": result
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e: # For empty data
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        # Catch-all for any other unexpected errors
        print(f"An unexpected error occurred: {e}")
        raise HTTPException(status_code=500, detail=f"An internal server error occurred: {e}")


@app.get("/get-comparisons")
async def get_comparisons_endpoint():
    """
    API endpoint to retrieve the comparisons.csv data.
    Returns the last 10 rows for display (all_rows contains all data for trend chart).
    """
    try:
        comparison_csv_path = COMPARISONS_FILE  # 使用全局路径
        
        if not os.path.exists(comparison_csv_path):
            return {
                "status": "success",
                "data": {
                    "rows": [],
                    "columns": [],
                    "all_rows": []
                }
            }
        
        # 读取CSV时，将空字符串自动转换为NaN
        # 指定 source_file 列为字符串类型，防止纯数字文件名被转换为数值
        df = pd.read_csv(
            comparison_csv_path, 
            encoding='utf-8', 
            na_values=['', ' '], 
            keep_default_na=True,
            dtype={'source_file': str}
        )
        
        # 过滤掉完全空的行
        df = df.dropna(how='all')
        
        # 过滤掉数据列全为空的行
        data_columns = ['mean_ms', 'p50_ms', 'p90_ms', 'p99_ms', 'p999_ms']
        if all(col in df.columns for col in data_columns):
            df = df.dropna(subset=data_columns, how='all')
        
        # 如果数据为空（只有列标题），返回空数据
        if df.empty:
            return {
                "status": "success",
                "data": {
                    "rows": [],
                    "columns": list(df.columns),
                    "all_rows": []
                }
            }
        
        # 将NaN值替换为None（可以被JSON序列化）
        df = df.replace({np.nan: None, np.inf: None, -np.inf: None})
        
        # 取最后10行用于显示（保存的数据没有限制）
        last_n_rows = df.tail(10)
        
        return {
            "status": "success",
            "data": {
                "rows": last_n_rows.to_dict('records'),
                "columns": list(df.columns),
                "all_rows": df.to_dict('records')  # 用于趋势图，包含全部数据
            }
        }
    except Exception as e:
        print(f"Error reading comparisons.csv: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to read comparisons: {e}")


@app.delete("/clear-comparisons")
async def clear_comparisons_endpoint():
    """
    API endpoint to clear the comparisons.csv file.
    """
    try:
        comparison_csv_path = COMPARISONS_FILE
        
        if os.path.exists(comparison_csv_path):
            os.remove(comparison_csv_path)
            print(f"Cleared comparisons file: {comparison_csv_path}")
        
        return {
            "status": "success",
            "message": "Comparisons history cleared successfully."
        }
    except Exception as e:
        print(f"Error clearing comparisons: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to clear comparisons: {e}")


class MergeRowsRequest(BaseModel):
    row_indices: list[int]
    merged_data: dict


@app.post("/merge-rows")
async def merge_rows_endpoint(request: MergeRowsRequest):
    """
    API endpoint to merge multiple rows in comparisons.csv by averaging numeric columns.
    """
    try:
        comparison_csv_path = COMPARISONS_FILE
        
        if not os.path.exists(comparison_csv_path):
            raise HTTPException(status_code=404, detail="Comparisons file not found")
        
        # 读取现有数据，指定 source_file 为字符串类型
        df = pd.read_csv(comparison_csv_path, dtype={'source_file': str})
        
        if len(request.row_indices) < 2:
            raise HTTPException(status_code=400, detail="At least 2 rows required for merging")
        
        # 验证索引有效性
        for idx in request.row_indices:
            if idx < 0 or idx >= len(df):
                raise HTTPException(status_code=400, detail=f"Invalid row index: {idx}")
        
        # 创建合并后的新行（使用前端计算的数据）
        merged_row = pd.DataFrame([request.merged_data])
        
        # 删除被合并的行（从后往前删除，避免索引变化）
        indices_to_delete = sorted(request.row_indices, reverse=True)
        for idx in indices_to_delete:
            df = df.drop(idx).reset_index(drop=True)
        
        # 添加合并后的行到末尾
        df = pd.concat([df, merged_row], ignore_index=True)
        
        # 保存更新后的CSV
        df.to_csv(comparison_csv_path, index=False, encoding='utf-8')
        
        print(f"Merged {len(request.row_indices)} rows in comparisons.csv")
        
        return {
            "status": "success",
            "message": f"Successfully merged {len(request.row_indices)} rows",
            "rows_merged": len(request.row_indices)
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error merging rows: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to merge rows: {e}")


class DeleteRowsRequest(BaseModel):
    row_indices: list[int]


@app.delete("/delete-rows")
async def delete_rows_endpoint(request: DeleteRowsRequest):
    """
    API endpoint to delete selected rows from comparisons.csv.
    """
    try:
        comparison_csv_path = COMPARISONS_FILE
        
        if not os.path.exists(comparison_csv_path):
            raise HTTPException(status_code=404, detail="Comparisons file not found")
        
        # 读取现有数据，指定 source_file 为字符串类型
        df = pd.read_csv(comparison_csv_path, dtype={'source_file': str})
        
        if len(request.row_indices) == 0:
            raise HTTPException(status_code=400, detail="At least 1 row required for deletion")
        
        # 验证索引有效性
        for idx in request.row_indices:
            if idx < 0 or idx >= len(df):
                raise HTTPException(status_code=400, detail=f"Invalid row index: {idx}")
        
        # 删除选中的行（从后往前删除，避免索引变化）
        indices_to_delete = sorted(request.row_indices, reverse=True)
        for idx in indices_to_delete:
            df = df.drop(idx).reset_index(drop=True)
        
        # 保存更新后的CSV
        df.to_csv(comparison_csv_path, index=False, encoding='utf-8')
        
        print(f"Deleted {len(request.row_indices)} rows from comparisons.csv")
        
        return {
            "status": "success",
            "message": f"Successfully deleted {len(request.row_indices)} rows",
            "rows_deleted": len(request.row_indices)
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting rows: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete rows: {e}")


@app.get("/get-config")
async def get_config_endpoint():
    """
    API endpoint to retrieve user configuration.
    """
    try:
        if not os.path.exists(CONFIG_FILE):
            return {
                "status": "success",
                "data": {
                    "input_dir": "",
                    "output_base_dir": "",
                    "comparisons_file": COMPARISONS_FILE
                }
            }
        
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        # 添加 comparisons_file 路径
        config["comparisons_file"] = COMPARISONS_FILE
        
        return {
            "status": "success",
            "data": config
        }
    except Exception as e:
        print(f"Error reading config: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to read config: {e}")


@app.post("/save-config")
async def save_config_endpoint(config: ConfigData):
    """
    API endpoint to save user configuration.
    """
    try:
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(config.dict(), f, ensure_ascii=False, indent=2)
        
        print(f"Configuration saved: {config.dict()}")
        
        return {
            "status": "success",
            "message": "Configuration saved successfully."
        }
    except Exception as e:
        print(f"Error saving config: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save config: {e}")


# --- Main Entry Point ---
if __name__ == "__main__":
    print("Starting RTT Analyzer Backend Server...")
    print(f"Comparisons data will be stored at: {COMPARISONS_FILE}")
    # Runs the server on http://127.0.0.1:8000
    # 使用 log_level="error" 减少不必要的日志输出
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="error")
