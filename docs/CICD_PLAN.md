# CI/CD Plan — SMS Project (GitHub Actions)

**Version:** 1.0  
**Date:** 2026-04-10  
**Method:** GitHub Actions + SSH Deploy  
**Status:** Planning

---

## 1. Goal

Har baar jab `main` branch pe code push ho — GitHub automatically:
1. Code checkout kare
2. Server pe SSH kare
3. Latest code pull kare
4. Docker containers rebuild kare aur restart kare
5. Health check kare

**Developer workflow:**
```
git push origin main
       ↓
GitHub Actions chalega (automatic)
       ↓
Server pe deploy ho jayega (automatic)
       ↓
Done — manually server pe jaana nahi padega
```

---

## 2. File Structure Jo Banana Hai

```
SMS/
├── .github/
│   └── workflows/
│       ├── deploy.yml          ← Production deploy (main branch)
│       └── test.yml            ← Tests run (every PR) [optional - future]
├── docker-compose.yml          ← already exists
├── .env                        ← server pe rahega, NEVER git mein
└── .gitignore                  ← .env already ignore hona chahiye
```

---

## 3. deploy.yml — Complete Flow

### Trigger
```yaml
on:
  push:
    branches: [main]     # sirf main pe push hone pe deploy hoga
```

### Jobs

```
Job 1: deploy
  Step 1: GitHub se code checkout
  Step 2: SSH se server pe connect karo
  Step 3: cd /project/path
  Step 4: git pull origin main
  Step 5: docker compose up --build -d
  Step 6: docker compose ps (verify all containers running)
  Step 7: Health check API hit karo
```

### Full deploy.yml Content

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    name: Deploy to Server
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          port: ${{ secrets.SERVER_PORT }}
          script: |
            set -e

            # Project directory pe jao
            cd ${{ secrets.SERVER_PATH }}

            # Latest code pull karo
            git pull origin main

            # Containers rebuild aur restart karo
            docker compose up --build -d

            # Purane unused images clean karo
            docker image prune -f

            # Status check karo
            docker compose ps

      - name: Health Check
        run: |
          sleep 30
          curl --fail ${{ secrets.HEALTH_CHECK_URL }}/api/health/ || exit 1

      - name: Notify on failure
        if: failure()
        run: echo "Deploy failed! Check GitHub Actions logs."
```

---

## 4. GitHub Secrets — Kya Set Karna Hai

GitHub Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| Secret Name | Value | Example |
|-------------|-------|---------|
| `SERVER_HOST` | Server ka IP ya domain | `192.168.1.100` ya `ss1.idaraalkhair.sbs` |
| `SERVER_USER` | SSH username | `root` ya `ubuntu` ya `rahat` |
| `SSH_PRIVATE_KEY` | Private SSH key (pura content) | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `SERVER_PORT` | SSH port | `22` |
| `SERVER_PATH` | Project ka full path server pe | `/home/rahat/Documents/My-Projects/SMS` |
| `HEALTH_CHECK_URL` | Server ka URL | `http://ss1.idaraalkhair.sbs` |

---

## 5. Server Pe One-Time Setup

Pehli baar server pe ye karna hai (sirf ek baar):

### Step 1: SSH Key Setup

**Apne local machine pe:**
```bash
# New SSH key pair banao (agar nahi hai)
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_deploy

# Public key content dekho
cat ~/.ssh/github_deploy.pub
```

**Server pe:**
```bash
# Public key authorized_keys mein add karo
echo "PUBLIC_KEY_CONTENT" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

**GitHub Secrets mein:**
- `SSH_PRIVATE_KEY` = `~/.ssh/github_deploy` ka pura content (private key)

### Step 2: Server Pe Git Setup

```bash
# Server pe project directory mein jao
cd /home/rahat/Documents/My-Projects/SMS

# GitHub se HTTPS ya SSH pull karne ki permission verify karo
git remote -v
git pull origin main    # test karo
```

### Step 3: Server Pe Docker Compose V2 Verify Karo

```bash
docker compose version    # V2 hona chahiye (plugin)
# Output: Docker Compose version v2.x.x
```

---

## 6. Deploy Strategies

### Strategy A: Simple SSH Deploy (RECOMMENDED — Abhi)

```
push to main
     ↓
SSH → git pull → docker compose up --build -d
```

**Pros:**
- Setup simple hai
- Debugging easy
- Koi extra infra nahi chahiye

**Cons:**
- Build time pe ~2-3 min downtime (containers restart hote hain)
- Server pe build hota hai (CPU use)

**5000 users ke liye ye kaafi hai.**

---

### Strategy B: Zero-Downtime Deploy (Future — 10,000+ users)

```
push to main
     ↓
GitHub Actions: Docker image build karo
     ↓
Push image to GitHub Container Registry (ghcr.io)
     ↓
SSH → docker compose pull → docker compose up -d
     ↓ (rolling restart — ek ek container restart hota hai)
Zero downtime
```

**Extra setup chahiye:**
- GitHub Container Registry (`ghcr.io`) ya Docker Hub
- `docker-compose.yml` mein `image:` field set honi chahiye
- Rolling update config

---

## 7. Branch Strategy

```
main branch        ← PRODUCTION (deploy hota hai)
     ↑
develop branch     ← Testing/staging (optional future)
     ↑
feature/xxx        ← Developer branches
```

**Rules:**
- Koi directly `main` pe commit na kare
- PR banao → review → merge to main → auto deploy
- `main` pe push = production pe deploy

---

## 8. Rollout Steps (Implementation Order)

```
Step 1: .github/workflows/ folder banao
Step 2: deploy.yml file banao
Step 3: GitHub Secrets set karo (6 secrets)
Step 4: Server pe SSH key setup karo
Step 5: Server pe git pull test karo manually
Step 6: Test push karo main pe
Step 7: GitHub Actions tab mein deploy monitor karo
Step 8: Health check URL verify karo
```

---

## 9. Troubleshooting

### Deploy fail ho jaye to:

```bash
# GitHub Actions logs dekho:
# GitHub Repo → Actions → Failed workflow → Click karo

# Server pe manually check karo:
cd /home/rahat/Documents/My-Projects/SMS
docker compose ps
docker compose logs backend --tail=50
```

### Common Issues

| Error | Cause | Fix |
|-------|-------|-----|
| `Permission denied (publickey)` | SSH key wrong hai | Private key dobara GitHub secret mein daalo |
| `git pull` fails | Git credentials issue | Server pe `git remote -v` check karo |
| Container not starting | `.env` file missing server pe | `.env` manually server pe banao |
| Health check fails | Container start hone mein time lag raha | Sleep 30s → 60s kar do |

---

## 10. .env File — Important Note

**.env file git mein KABHI NAHI jayegi.**

Server pe manually `.env` banana padega ek baar:

```bash
# Server pe
cd /home/rahat/Documents/My-Projects/SMS
nano .env    # ya cp .env.example .env
# Values bharo
```

`.gitignore` mein ye hona chahiye:
```
.env
*.env
```

---

## 11. Complete CI/CD + Scalability Combined Flow (Final State)

```
Developer → git push origin main
                    ↓
            GitHub Actions starts
                    ↓
            SSH → Server
                    ↓
            git pull (new code)
                    ↓
            docker compose up --build -d
                    ↓
         ┌──────────┴──────────┐
    [Nginx LB]            [PgBouncer]
    ↙   ↓   ↘                 ↓
[B-1][B-2][B-3]         [PostgreSQL]
         ↓
     [Redis Cache]
                    ↓
            Health Check Pass ✓
                    ↓
            Deploy Complete ✓
```
