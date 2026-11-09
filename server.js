// 节点状态页：实时 TCP 检测三条代理线是否存活
// 零依赖，只用 Node 内置模块。部署：Cloady 新应用，Node，端口 3000。
// v2：显式 DNS 解析（系统 DNS 失败时走 DoH 兜底），报错分阶段（dns / connect），
// 因为 Cloady 容器内直接连域名会超时，而直连 IP 正常。
const http = require('http');
const net = require('net');
const dns = require('dns').promises;
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

const NODES = [
  { id: 'racknerd', name: 'RackNerd 主线', host: '192.236.184.71', port: 443, desc: 'VLESS+REALITY · 手机主力 · 美国 · $21.99/年' },
  { id: 'pxxl', name: 'Pxxl 备用', host: 'pxxl-vless-grhliu.pxxlspace.cv', port: 443, desc: 'VLESS+WS+TLS · 出口美国弗吉尼亚 · 50 GiB/月' },
  { id: 'cloady', name: 'Cloady 备用', host: 'xray-e1nssgpr-workspace-2uey64.cloady.io', port: 443, desc: 'VLESS+WS+TLS · 西雅图 usw1 · 10GB/月' },
];

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

// 解析域名到 IPv4：先系统 DNS，失败再走 DoH（dns.google）
async function resolveIPv4(host) {
  try {
    const r = await withTimeout(dns.lookup(host, { family: 4 }), 4000);
    return { ip: r.address, via: 'dns' };
  } catch (e) { /* fall through to DoH */ }
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(`https://dns.google/resolve?name=${host}&type=A`, { signal: ctrl.signal });
    clearTimeout(t);
    const j = await res.json();
    const a = j.Answer && j.Answer.find((x) => x.type === 1);
    if (a) return { ip: a.data, via: 'doh' };
  } catch (e) { /* fall through */ }
  return { ip: null, via: null };
}

function tcpConnect(ip, port, timeoutMs = 6000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = net.createConnection({ host: ip, port, timeout: timeoutMs });
    socket.on('connect', () => {
      const ms = Date.now() - start;
      socket.destroy();
      resolve({ ok: true, ms });
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve({ ok: false, error: 'connect-timeout' });
    });
    socket.on('error', (e) => {
      resolve({ ok: false, error: e.code || 'connect-error' });
    });
  });
}

async function checkNode(n) {
  const isIp = /^\d+\.\d+\.\d+\.\d+$/.test(n.host);
  let ip = n.host;
  let via = 'direct-ip';
  if (!isIp) {
    const r = await resolveIPv4(n.host);
    if (!r.ip) {
      return { ...n, ok: false, ms: null, error: 'dns', stage: 'dns', at: new Date().toISOString() };
    }
    ip = r.ip;
    via = r.via;
  }
  const r = await tcpConnect(ip, n.port);
  return { ...n, ok: r.ok, ms: r.ms ?? null, error: r.error || null, stage: r.ok ? 'ok' : 'connect', resolved: ip, resolvedVia: via, at: new Date().toISOString() };
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/api/status') {
    const results = await Promise.all(NODES.map(checkNode));
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(results));
    return;
  }
  const html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
});

server.listen(PORT, () => console.log('proxy-status listening on ' + PORT));
