# NoMoreAISlop - Deployment Guide

> Version: 2.2.0 | Last Updated: 2026-01-12 | Status: Production

## Quick Start

```bash
git clone https://github.com/nomoreaislop/nomoreaislop.git
cd nomoreaislop
npm install
cp .env.example .env
# Edit .env with your API keys
npm run build && npm test
npx tsx scripts/analyze-style.ts  # CLI analysis
npm run ui                         # Optional: Web UI
```

## Prerequisites

| Requirement | Minimum | Recommended | Check |
|------------|---------|------------|-------|
| Node.js | 18.0.0 | 18.x LTS | `node --version` |
| npm | 9.0.0 | Latest | `npm --version` |
| Git | Any | Latest | `git --version` |
| RAM | 512 MB | 2 GB | - |
| Disk | 100 MB | 500 MB | - |

**Optional Dependencies:**
- Supabase account (free tier: https://supabase.com)
- Anthropic API key (https://console.anthropic.com/)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Optional | Anthropic API key for LLM analysis |
| `SUPABASE_URL` | Optional | Supabase project URL |
| `SUPABASE_ANON_KEY` | Optional | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional | Supabase service role (server-side only) |
| `NOSLOP_MODEL` | Optional | Override model (default: claude-sonnet-4-5-20241022) |
| `NOSLOP_TELEMETRY` | Optional | Enable/disable telemetry |
| `NODE_ENV` | Optional | Set to `production` for prod |

**Security:** Never commit `.env` to git (it's in `.gitignore`).

## Development Setup

1. **Clone & Install**
   ```bash
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   nano .env
   ```

3. **Verify Installation**
   ```bash
   npm run typecheck && npm run lint && npm test
   ```

4. **Start Development** (use separate terminals)
   ```bash
   npm run dev            # Watch mode
   npx tsx scripts/analyze-style.ts  # CLI
   npm run ui             # Web UI (optional)
   ```

## Testing

| Command | Purpose |
|---------|---------|
| `npm test` | Run all tests once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Generate coverage report |
| `npx tsx scripts/analyze-style.ts` | Test CLI analysis |
| `npm run ui` | Test web UI (http://localhost:5173) |
| `curl http://localhost:3001/health` | Test API health |
| `npx tsx scripts/test-supabase.ts` | Test Supabase connection |

## Building for Distribution

```bash
npm run build              # Compile to dist/
cd web-ui && npm run build # Build web assets
tar -czf nomoreaislop-2.2.0.tar.gz dist/ web-ui/dist/ package.json README.md LICENSE
node dist/index.js --version  # Verify build
```

## Deployment Options

| Method | Best For | Quick Start |
|--------|----------|-------------|
| **Docker** | Self-hosted, scalable | `docker build -t nomoreaislop:2.2.0 . && docker run -p 3001:3001 nomoreaislop:2.2.0` |
| **Heroku** | Quick cloud deployment | `heroku create && heroku config:set ANTHROPIC_API_KEY=... && git push heroku main` |
| **PM2** | Production process manager | `npm install -g pm2 && pm2 start ecosystem.config.js && pm2 startup` |
| **Nginx + Node** | Full control, reverse proxy | Configure upstream & proxy_pass [see detailed guide] |

### Docker Setup

1. **Dockerfile** (pre-build locally with `npm run build`):
   ```dockerfile
   FROM node:18-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production
   COPY dist/ ./dist/
   ENV NODE_ENV=production
   HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
     CMD node -e "require('http').get('http://localhost:3001/health', (r) => {if(r.statusCode !== 200) throw new Error(r.statusCode)})"
   CMD ["node", "dist/api/index.js"]
   ```

2. **.dockerignore**:
   ```
   node_modules npm-debug.log .env .git tests web-ui scripts
   ```

3. **Build & Run**:
   ```bash
   docker build -t nomoreaislop:2.2.0 .
   docker run -d --name nomoreaislop -p 3001:3001 \
     -e ANTHROPIC_API_KEY=sk-ant-... \
     nomoreaislop:2.2.0
   docker logs nomoreaislop
   ```

### PM2 Setup

```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 status && pm2 logs nomoreaislop-api
pm2 startup && pm2 save
```

**ecosystem.config.js**:
```javascript
module.exports = {
  apps: [{
    name: 'nomoreaislop-api',
    script: './dist/api/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: { NODE_ENV: 'production', PORT: 3001 },
    error_file: 'logs/error.log',
    out_file: 'logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
```

### Nginx Reverse Proxy

```nginx
upstream api_backend { server localhost:3001; }
upstream web_frontend { server localhost:5173; }

server {
    listen 80;
    server_name api.nomoreaislop.com;
    client_max_body_size 10M;

    location /api/ {
        proxy_pass http://api_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_connect_timeout 60s;
        proxy_read_timeout 60s;
    }

    location /health { proxy_pass http://api_backend; access_log off; }
    location / { proxy_pass http://web_frontend; }
}

server {
    listen 443 ssl http2;
    server_name api.nomoreaislop.com;
    ssl_certificate /etc/letsencrypt/live/api.nomoreaislop.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.nomoreaislop.com/privkey.pem;
    # Copy location blocks from http block above
}
```

Enable:
```bash
sudo ln -s /etc/nginx/sites-available/nomoreaislop /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx
```

### SSL/TLS Certificates (Let's Encrypt)

```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot certonly --nginx -d api.nomoreaislop.com
sudo systemctl enable certbot.timer && sudo systemctl start certbot.timer
```

### Supabase Database Setup

1. Create project at https://supabase.com/dashboard
2. Copy URL and anon key from Settings > API
3. Run schema in SQL Editor: paste `supabase/schema.sql` and execute
4. Add to `.env.production`:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=eyJhbGc...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
   ```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `npm ERR! code ERESOLVE` | `npm cache clean --force && npm install --legacy-peer-deps` |
| Node version mismatch | `nvm install 18 && nvm use 18` |
| `tsc: command not found` | Use `npm run build` instead of `tsc` directly |
| `dist` directory missing | `rm -rf dist && npm run build` |
| Port 3001/5173 already in use | `lsof -i :3001` then `kill -9 <PID>` or use different port |
| `ENOENT: no such file or directory` | Verify `~/.claude/projects/` exists or run Claude Code first |
| Missing API key | `grep ANTHROPIC_API_KEY .env` or `export ANTHROPIC_API_KEY=...` |
| Supabase connection refused | `npx tsx scripts/test-supabase.ts` and check project is not paused |
| Unknown table error | Paste `supabase/schema.sql` in Supabase SQL Editor and execute |
| Cannot find module | `rm -rf node_modules && npm install && npm run build` |
| Port conflict (Web UI) | Vite auto-increments to next port automatically |
| Blank page / Webpack error | `cd web-ui && npm install && npm run build` |
| Connection timeout | `API_TIMEOUT=60000 npm run api:dev` |
| Rate limit exceeded | Wait minutes or reduce batch size with `NOSLOP_BATCH_SIZE=5` |
| Duplicate key violations | Delete duplicates in Supabase SQL Editor [see detailed guide] |
| Connection pool exhausted | Enable connection pooling in Supabase dashboard |
| Debug output | `DEBUG=nomoreaislop:* npm run dev` |

## Monitoring & Health Checks

**Health Endpoint**:
```bash
curl http://localhost:3001/health
# { "status": "ok", "timestamp": "...", "uptime": 3600, "version": "2.2.0" }
```

**Metrics Endpoint**:
```bash
curl http://localhost:3001/metrics
# { "requests_total": 1250, "requests_errors": 5, "response_time_avg_ms": 145, ... }
```

**View Logs**:
- PM2: `pm2 logs nomoreaislop-api`
- Docker: `docker logs nomoreaislop -f`
- Files: `tail -f logs/error.log logs/out.log`

**PM2 Monitoring**:
```bash
pm2 install pm2-auto-restart
pm2 monit              # Watch memory/CPU
pm2 web                # Dashboard on port 9615
```

**Load Testing**:
```bash
npm install -g artillery
artillery run load-test.yml
```

## Pre-Deployment Checklist

- [ ] All tests pass: `npm test`
- [ ] TypeScript compiles: `npm run typecheck`
- [ ] No lint errors: `npm run lint`
- [ ] Build succeeds: `npm run build`
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] SSL/TLS certificates valid
- [ ] Reverse proxy configured
- [ ] Health check responds
- [ ] Monitoring/logging enabled
- [ ] Backup strategy in place
- [ ] Disaster recovery plan documented

## Related Documentation

- [Architecture Guide](./ARCHITECTURE.md) - System design and components
- [README](../README.md) - Project overview and quick start
- [Data Models](./DATA_MODELS.md) - Database schemas and types

## Support

1. **Check logs**: `npm run dev` or `docker logs nomoreaislop`
2. **Search issues**: https://github.com/nomoreaislop/nomoreaislop/issues
3. **Open issue**: Include error logs and steps to reproduce
4. **Community**: https://github.com/nomoreaislop/nomoreaislop/discussions
