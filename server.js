// 节点状态页：实时 TCP 检测三条代理线是否存活
// 零依赖，只用 Node 内置模块。部署：Pxxl 新项目，Node，端口 3000。
const http = require('http');
const net = require('net');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

const NODES = [
  { id: 'racknerd', name: 'RackNerd 主线', host: '192.236.184.71', port: 443, desc: 'VLESS+REALITY · 手机主力 · 美国 · $21.99/年' },
  { id: 'pxxl', name: 'Pxxl 备用', host: 'pxxl-vless-grhliu.pxxlspace.cv', port: 443, desc: 'VLESS+WS+TLS · 出口美国弗吉尼亚 · 50 GiB/月' },
  { id: 'cloady', name: 'Cloady 备用', host: 'xray-e1nssgpr-workspace-2uey64.cloady.io', port: 443, desc: 'VLESS+WS+TLS · 西雅图 usw1 · 10GB/月' },
];

function tcpCheck(host, port, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = net.createConnection({ host, port, timeout: timeoutMs });
    socket.on('connect', () => {
      const ms = Date.now() - start;
      socket.destroy();
      resolve({ ok: true, ms });
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve({ ok: false, ms: null, error: 'timeout' });
    });
    socket.on('error', (e) => {
      resolve({ ok: false, ms: null, error: e.code || 'error' });
    });
  });
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/api/status') {
    const results = await Promise.all(
      NODES.map(async (n) => {
        const r = await tcpCheck(n.host, n.port);
        return { ...n, ...r, at: new Date().toISOString() };
      })
    );
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(results));
    return;
  }
  const html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
});

server.listen(PORT, () => console.log('proxy-status listening on ' + PORT));
