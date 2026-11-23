#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""本地预览《小满的2000年》画册。

用法:
    python serve.py          # 默认 http://127.0.0.1:8099/
    python serve.py 9000     # 指定端口

只依赖 Python 标准库，不需要 npm / node。
"""
from __future__ import annotations

import functools
import http.server
import os
import socket
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".json": "application/json",
    }

    def end_headers(self) -> None:
        # 开发期禁用缓存，改完刷新就能看到
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write("[storybook] %s\n" % (fmt % args))


def pick_port(preferred: int) -> int:
    for port in [preferred, *range(preferred + 1, preferred + 12)]:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
            probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                probe.bind(("127.0.0.1", port))
            except OSError:
                continue
            return port
    raise SystemExit("没有可用的本地端口，请手动指定: python serve.py 9000")


def main() -> None:
    preferred = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get("PORT", 8099))
    port = pick_port(preferred)
    handler = functools.partial(Handler, directory=str(ROOT))
    with http.server.ThreadingHTTPServer(("127.0.0.1", port), handler) as httpd:
        print(f"《小满的2000年》预览已启动: http://127.0.0.1:{port}/", flush=True)
        print("按 Ctrl+C 停止。", flush=True)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n已停止。")


if __name__ == "__main__":
    main()
