#!/usr/bin/env bash
# 环境检查 + 确保 CDP Proxy 就绪 — 轻量包装，实际逻辑在 check-deps.mjs
#
# 保留本文件是为了兼容旧文档/旧站点经验里的 `bash scripts/check-deps.sh` 调用。
# 新逻辑（浏览器 = 用户数据目录、复用已有服务、首次配置引导）全部在 check-deps.mjs 中。
#
# 用法与原脚本一致；额外参数（如 --browser <数据目录>）原样透传。
# 退出码沿用 check-deps.mjs：0 就绪 / 1 错误 / 2 首次配置。

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec node "$SCRIPT_DIR/check-deps.mjs" "$@"
