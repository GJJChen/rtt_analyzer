# 修复打开文件夹权限问题

## 问题描述

当尝试使用 `openPath()` API 打开文件夹时，出现以下错误：
```
Failed to open input directory: Not allowed to open path D:\Projects\rtt_analyzer
```

## 原因

Tauri v2 的 opener 插件出于安全考虑，默认不允许打开任意路径。需要在 capabilities 配置中明确授予权限。

## 解决方案

在 `src-tauri/capabilities/default.json` 中，将 `opener:allow-open-path` 从简单权限改为配置对象，允许打开所有路径：

### 修改前
```json
{
  "permissions": [
    "opener:allow-open-path",
    // ... 其他权限
  ]
}
```

### 修改后
```json
{
  "permissions": [
    // 移除简单的权限字符串
    {
      "identifier": "opener:allow-open-path",
      "allow": [
        {
          "path": "**"
        }
      ]
    },
    // ... 其他权限
  ]
}
```

## 配置说明

- `"path": "**"` 表示允许打开任意路径
- 这与 `fs:allow-write-file` 的配置方式类似
- 如果需要限制只能打开特定路径，可以修改 path 模式

## 测试步骤

1. 保存配置文件
2. 重启开发服务器（`pnpm tauri dev`）
3. 在应用中配置输入/输出目录
4. 点击绿色的"打开文件夹"按钮
5. 确认文件管理器成功打开对应目录

## 安全注意事项

- 此配置允许应用打开任意文件夹路径
- 在生产环境中，如果需要更严格的安全控制，可以使用具体的路径模式
- 例如：`"path": "$HOME/**"` 只允许打开用户目录下的路径

## 相关文件

- `src-tauri/capabilities/default.json` - Tauri 权限配置
- `src/App.jsx` - 包含 `openInputDir()` 和 `openOutputBaseDir()` 函数
