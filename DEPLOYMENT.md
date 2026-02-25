# Cortex — Production Deployment Guide

> A complete playbook for deploying Cortex to production with Docker, Kubernetes, and cloud-native infrastructure.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Configuration](#environment-configuration)
3. [Option A — Docker Compose (Simple VPS)](#option-a--docker-compose-simple-vps)
4. [Option B — Kubernetes (Enterprise / High Availability)](#option-b--kubernetes-enterprise--high-availability)
5. [Option C — Cloud Platforms (AWS / GCP / Azure)](#option-c--cloud-platforms)
6. [Database: PostgreSQL Setup](#database-postgresql-setup)
7. [SSL & Reverse Proxy (Nginx)](#ssl--reverse-proxy-nginx)
8. [AI & SMS Services](#ai--sms-services)
9. [Maintenance & Backups](#maintenance--backups)
10. [Monitoring & Health Checks](#monitoring--health-checks)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Requirement | Minimum Version | Purpose |
|---|---|---|
| Linux VPS | Ubuntu 22.04+ | Execution environment |
| Docker | 24+ | Containerization |
| Docker Compose | v2.20+ | Multi-service orchestration |
| kubectl | 1.28+ | Kubernetes management |
| PostgreSQL | 15+ | Production database |
| Node.js | 20 LTS | Local development only |
| Domain Name | — | HTTPS / SSL |

---

## Environment Configuration

Create a `.env` file in the project root. **Never commit this file to version control.**

```bash
# .env
JWT_SECRET="your-super-secret-key-min-32-chars"
INITIAL_ADMIN_PASSWORD="YourSecureAdminP@ssw0rd"
NODE_ENV="production"

# PostgreSQL (for production)
DB_URL="postgresql://cortex_user:your_db_password@localhost:5432/cortex_db"

# Google Gemini AI
GEMINI_API_KEY="AIzaSy..."

# Afro Message (SMS)
AFRO_MESSAGE_API_KEY="eyJhbGci..."
AFRO_MESSAGE_SENDER_ID="cortex"
```

> [!CAUTION]
> Generate a cryptographically secure `JWT_SECRET`:
> ```bash
> openssl rand -base64 48
> ```

---

## Option A — Docker Compose (Simple VPS)

Best for: **Single-school** or **small multi-school** setups on a single VPS.

### Step 1 — Clone & Configure
```bash
git clone https://github.com/your-org/cortex.git
cd cortex
cp .env.example .env
nano .env  # Fill in your secrets
```

### Step 2 — Build & Launch
```bash
docker-compose up -d --build
```

### Step 3 — Verify
```bash
docker-compose ps
docker-compose logs -f cortex-app
curl http://localhost:3000/api/health
# Expected: {"status":"healthy","timestamp":"..."}
```

### Step 4 — Enable Auto-Restart on Reboot
The `docker-compose.yml` already includes `restart: unless-stopped`. To ensure Docker itself starts on boot:
```bash
sudo systemctl enable docker
```

---

## Option B — Kubernetes (Enterprise / High Availability)

Best for: **100+ schools**, zero-downtime deployments, and automatic crash recovery.

### Step 1 — Build & Push the Docker Image
```bash
docker build -t your-registry.io/cortex-app:latest .
docker push your-registry.io/cortex-app:latest
```

### Step 2 — Update Image Reference
Edit `k8s/deployment.yaml` and replace `cortex-app:latest` with your registry image:
```yaml
image: your-registry.io/cortex-app:latest
```

### Step 3 — Create Kubernetes Secrets
```bash
kubectl create secret generic cortex-secrets \
  --from-literal=JWT_SECRET="your-secret" \
  --from-literal=INITIAL_ADMIN_PASSWORD="your-password" \
  --from-literal=DB_URL="postgresql://user:pass@postgres-service:5432/cortex_db" \
  --from-literal=GEMINI_API_KEY="your-key" \
  --from-literal=AFRO_MESSAGE_API_KEY="your-key" \
  --from-literal=AFRO_MESSAGE_SENDER_ID="cortex"
```

### Step 4 — Apply Manifests
```bash
# Apply in this specific order
kubectl apply -f k8s/pvc.yaml
kubectl apply -f k8s/postgres.yaml   # If deploying PG in-cluster
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
```

### Step 5 — Monitor Deployment
```bash
# Check pod status
kubectl get pods -w

# View logs
kubectl logs -f deployment/cortex-deployment

# Verify health
kubectl describe pod -l app=cortex
```

### Self-Healing Verification
```bash
# Simulate a crash — Kubernetes will auto-restart within ~10s
kubectl delete pod -l app=cortex

# Watch it recover
kubectl get pods -w
```

---

## Option C — Cloud Platforms

### AWS (EKS + RDS + ECR)
```bash
# 1. Push image to ECR
aws ecr get-login-password | docker login --username AWS --password-stdin <account>.dkr.ecr.<region>.amazonaws.com
docker tag cortex-app:latest <account>.dkr.ecr.<region>.amazonaws.com/cortex-app:latest
docker push <account>.dkr.ecr.<region>.amazonaws.com/cortex-app:latest

# 2. Use RDS PostgreSQL as DB_URL
# 3. Deploy with kubectl against your EKS cluster
kubectl apply -f k8s/
```

### Google Cloud (GKE + Cloud SQL)
```bash
# 1. Build and push to Artifact Registry
gcloud builds submit --tag gcr.io/your-project/cortex-app

# 2. Use Cloud SQL PostgreSQL as DB_URL (with Cloud SQL Auth Proxy)
# 3. Deploy to GKE
gcloud container clusters get-credentials cortex-cluster --region us-central1
kubectl apply -f k8s/
```

### DigitalOcean App Platform (Simplest)
1. Connect your GitHub repo in the App Platform dashboard.
2. Set environment variables directly in the dashboard.
3. Select the **Dockerfile** as the build method.
4. DigitalOcean handles SSL, scaling, and deployments automatically.

---

## Database: PostgreSQL Setup

### Local / VPS Setup
```bash
# Install PostgreSQL
sudo apt install postgresql-15

# Create database and user
sudo -u postgres psql <<EOF
CREATE USER cortex_user WITH PASSWORD 'your_db_password';
CREATE DATABASE cortex_db OWNER cortex_user;
GRANT ALL PRIVILEGES ON DATABASE cortex_db TO cortex_user;
EOF
```

### Connection String Format
```
postgresql://cortex_user:your_db_password@localhost:5432/cortex_db
```

> [!NOTE]
> Cortex automatically creates all tables and seeds default data on first startup via `initDB()`. No manual schema migrations needed.

---

## SSL & Reverse Proxy (Nginx)

```bash
# Install Nginx & Certbot
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx

# Create Nginx site config
sudo tee /etc/nginx/sites-available/cortex > /dev/null << 'EOF'
server {
    server_name your-domain.com www.your-domain.com;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";

    # Gzip compression
    gzip on;
    gzip_types text/plain application/json application/javascript text/css;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/cortex /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

---

## AI & SMS Services

Both services are configured via environment variables and will gracefully degrade if keys are missing (they log a warning instead of crashing).

### Gemini AI — Student Performance Insights
| Variable | Value |
|---|---|
| `GEMINI_API_KEY` | From [Google AI Studio](https://aistudio.google.com/) |

### Afro Message — SMS Notifications
| Variable | Value |
|---|---|
| `AFRO_MESSAGE_API_KEY` | Your Afro Message JWT token |
| `AFRO_MESSAGE_SENDER_ID` | `cortex` (or your registered sender ID) |

**Test SMS Connection:**
```bash
curl -X GET "https://api.afromessage.com/api/send" \
  -H "Authorization: Bearer $AFRO_MESSAGE_API_KEY" \
  -G \
  --data-urlencode "from=cortex" \
  --data-urlencode "to=+251912345678" \
  --data-urlencode "message=Cortex test message"
```

---

## Maintenance & Backups

### PostgreSQL Backup (Daily Cron)
```bash
# Create backup script
cat > /opt/cortex-backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y-%m-%d)
BACKUP_DIR="/var/backups/cortex"
mkdir -p $BACKUP_DIR
pg_dump -U cortex_user cortex_db | gzip > "$BACKUP_DIR/cortex-$DATE.sql.gz"
# Keep only last 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
echo "Backup completed: cortex-$DATE.sql.gz"
EOF
chmod +x /opt/cortex-backup.sh

# Schedule daily at 3 AM
(crontab -l 2>/dev/null; echo "0 3 * * * /opt/cortex-backup.sh") | crontab -
```

### Restore from Backup
```bash
gunzip -c /var/backups/cortex/cortex-2026-02-25.sql.gz | psql -U cortex_user cortex_db
```

### Application Updates
```bash
git pull
docker-compose up -d --build
# OR for Kubernetes:
kubectl set image deployment/cortex-deployment cortex-app=your-registry.io/cortex-app:new-version
kubectl rollout status deployment/cortex-deployment
```

### Rollback a Kubernetes Deployment
```bash
kubectl rollout undo deployment/cortex-deployment
```

---

## Monitoring & Health Checks

### Health Endpoint
```
GET /api/health
# Response: {"status":"healthy","timestamp":"2026-02-25T20:00:00.000Z"}
```

### Kubernetes Probes
The `deployment.yaml` configures automatic probes:
- **Readiness Probe** — Waits 10s before accepting traffic, checks `/api/health`.
- **Liveness Probe** — Checks every 30s. Restarts the container after 3 failures.

### Uptime Monitoring (Recommended)
Configure [UptimeRobot](https://uptimerobot.com) or [Betterstack](https://betterstack.com) to ping your `/api/health` endpoint every 5 minutes for free external monitoring.

---

## Troubleshooting

| Problem | Solution |
|---|---|
| App won't start | Check `docker-compose logs -f` or `kubectl logs -f deployment/cortex-deployment` |
| Database connection error | Verify `DB_URL` in `.env`. Ensure PostgreSQL is running and accessible. |
| Pod stuck in `CrashLoopBackOff` | Check logs with `kubectl describe pod <pod-name>` |
| 401 Unauthorized errors | Verify `JWT_SECRET` is set and consistent across all replicas |
| SMS not sending | Check `AFRO_MESSAGE_API_KEY` and `AFRO_MESSAGE_SENDER_ID` in `.env` |
| AI insights unavailable | Verify `GEMINI_API_KEY` is valid and has billing enabled |
| HTTPS not working | Re-run `sudo certbot renew` and check `sudo nginx -t` |
| Port 3000 in use | Run `lsof -i :3000` to find the conflicting process |
