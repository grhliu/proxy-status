# proxy-status 节点状态页

实时检测三条代理线是否存活（TCP 端口检测，每 30 秒自动刷新）：

- RackNerd 主线 `192.236.184.71:443`
- Pxxl 备用 `pxxl-vless-grhliu.pxxlspace.cv:443`
- Cloady 备用 `xray-e1nssgpr-workspace-2uey64.cloady.io:443`

## 运行

```bash
npm start
# 监听 $PORT（默认 3000）
```

零依赖，只用 Node 内置模块。页面不含任何账号、密码、UUID。
