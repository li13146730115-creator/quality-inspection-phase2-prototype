#!/usr/bin/env python3
"""Serve the exported prototype locally using Python's standard library."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import socket
import threading
import webbrowser

root = Path(__file__).resolve().parent
site = root / '站点'
if not site.exists():
    site = root / 'PC端' / 'dist' / 'client'
url = 'http://localhost:4173/'
try:
    server = ThreadingHTTPServer(('127.0.0.1', 4173), partial(SimpleHTTPRequestHandler, directory=str(site)))
except OSError:
    print('4173 端口已使用。请访问：' + url)
    webbrowser.open(url)
else:
    print('品质巡检二期原型：' + url)
    print('请保持此窗口打开，按 Control+C 停止。所有演示数据仅保存在当前浏览器。')
    threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
