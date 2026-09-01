# CI/CD Setup Guide — Step by Step
# GitHub Actions + SSH Deploy

---

## Pehle Se Kya Hai (Already Done)

- `.github/workflows/deploy.yml` file ban gayi hai repo mein
- Jab bhi `main` branch pe push hoga, ye file automatically server pe deploy karega

---

## Abhi Kya Karna Hai (Tumhara Kaam)

Poora setup 3 parts mein hai:

```
Part 1 → SSH Key banao (local machine + server)
Part 2 → GitHub PAT banao
Part 3 → GitHub Secrets set karo
```

---

---

# PART 1 — SSH Key Banao

SSH key GitHub Actions ko server pe connect karne deti hai bina password ke.

---

## Step 1.1 — Local Machine Pe Key Generate Karo

**Apne computer pe terminal kholo aur ye command run karo:**

```bash
ssh-keygen -t ed25519 -C "github-deploy" -f ~/.ssh/github_deploy -N ""
```

**Ye 2 files banegi:**
```
~/.ssh/github_deploy        ← Private Key (ye GitHub mein jayegi)
~/.ssh/github_deploy.pub    ← Public Key  (ye server mein jayegi)
```

---

## Step 1.2 — Public Key Server Pe Lagao

**Pehle public key ka content dekho:**

```bash
cat ~/.ssh/github_deploy.pub
```

Output kuch aisa hoga:
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA... github-deploy
```

**Ye puri line copy karo.**

**Ab server pe SSH se connect karo:**

```bash
ssh your_user@your_server_ip
```

**Server pe ye command run karo (copy ki hui key paste karo):**

```bash
echo "YAHAN_APNI_PUBLIC_KEY_PASTE_KARO" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

**Example:**
```bash
echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA... github-deploy" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

---

## Step 1.3 — Private Key Copy Karo (GitHub Ke Liye)

```bash
cat ~/.ssh/github_deploy
```

Output aisa hoga:
```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAA...
...bahut saari lines...
-----END OPENSSH PRIVATE KEY-----
```

**Ye pura content copy kar lo — baad mein GitHub Secret mein lagana hai.**
**`-----BEGIN`  se lekar `-----END OPENSSH PRIVATE KEY-----`  tak sab copy karo.**

---

---

# PART 2 — GitHub Personal Access Token (PAT) Banao

PAT GitHub Actions ko tumhara code pull karne ki permission deta hai.

---

## Step 2.1 — GitHub Pe Login Karo

`github.com` pe jao aur apne account se login karo.

---

## Step 2.2 — Settings Mein Jao

**Top right corner pe apni profile picture click karo:**

```
Profile Picture (top right)
    ↓
Settings
```

---

## Step 2.3 — Developer Settings Dhundo

**Left sidebar mein scroll karo bilkul neeche tak:**

```
Left Sidebar (scroll to bottom)
    ↓
Developer settings
```

---

## Step 2.4 — Personal Access Token Banao

```
Developer settings
    ↓
Personal access tokens
    ↓
Tokens (classic)
    ↓
Generate new token
    ↓
Generate new token (classic)
```

---

## Step 2.5 — Token Configure Karo

**Note field mein likho:**
```
SMS Deploy
```

**Expiration select karo:**
```
1 year  (ya jitna chaaho)
```

**Scopes mein sirf ye ek tick karo:**
```
☑ repo        ← ye tick karo, baaki sab chhod do
```

---

## Step 2.6 — Token Generate Karo

```
Scroll down
    ↓
Generate token (green button)
```

**Token generate hoga — kuch aisa dikhega:**
```
ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**IMPORTANT: Ye token sirf ek baar dikhega — abhi copy karo aur kahin safe rakh lo.**
Agar bhool gaye to delete karke naya banana padega.

---

---

# PART 3 — GitHub Repository Secrets Set Karo

Secrets wo private values hain jo GitHub Actions use karta hai — ye kisi ko nahi dikhte.

---

## Step 3.1 — Repository Ke Settings Mein Jao

**`github.com/Al-Khair-IT/SMS` pe jao:**

```
Repository page
    ↓
Settings tab (top menu mein)
    ↓
Secrets and variables (left sidebar)
    ↓
Actions
    ↓
New repository secret (green button)
```

---

## Step 3.2 — 7 Secrets Banao (Ek Ek Karke)

Har secret ke liye: **Name** daalo → **Secret** daalo → **Add secret** click karo.

---

### Secret 1 — SERVER_HOST

```
Name:   SERVER_HOST
Secret: (apna server IP ya domain)

Example: 192.168.1.100
     ya: ss1.idaraalkhair.sbs
```

---

### Secret 2 — SERVER_USER

```
Name:   SERVER_USER
Secret: (server pe SSH username)

Example: root
     ya: ubuntu
     ya: rahat
```

---

### Secret 3 — SSH_PRIVATE_KEY

```
Name:   SSH_PRIVATE_KEY
Secret: (Part 1 mein copy ki hui private key — puri ki puri paste karo)

Example:
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAA...
...
-----END OPENSSH PRIVATE KEY-----
```

---

### Secret 4 — SERVER_PORT

```
Name:   SERVER_PORT
Secret: 22
```

---

### Secret 5 — SERVER_PATH

```
Name:   SERVER_PATH
Secret: (server pe project ka full path)

Example: /home/rahat/Documents/My-Projects/SMS
```

---

### Secret 6 — HEALTH_CHECK_URL

```
Name:   HEALTH_CHECK_URL
Secret: (tumhara domain — bina trailing slash ke)

Example: http://ss1.idaraalkhair.sbs
```

---

### Secret 7 — GH_PAT

```
Name:   GH_PAT
Secret: (Part 2 mein copy kiya hua GitHub token)

Example: ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## Step 3.3 — Verify Karo

**Sab secrets add hone ke baad aisa dikhna chahiye:**

```
Repository secrets (7)

SERVER_HOST         Updated just now
SERVER_USER         Updated just now
SSH_PRIVATE_KEY     Updated just now
SERVER_PORT         Updated just now
SERVER_PATH         Updated just now
HEALTH_CHECK_URL    Updated just now
GH_PAT              Updated just now
```

---

---

# PART 4 — Pehli Baar Deploy Karo (Test)

---

## Step 4.1 — Code Push Karo

**Local machine pe SMS project folder mein jao:**

```bash
cd /home/rahat/Documents/My-Projects/SMS
```

**Workflow file commit aur push karo:**

```bash
git add .github/
git commit -m "ci: add GitHub Actions deploy workflow"
git push origin main
```

---

## Step 4.2 — GitHub Actions Monitor Karo

**`github.com/Al-Khair-IT/SMS` pe jao:**

```
Repository page
    ↓
Actions tab (top menu mein)
    ↓
"Deploy to Production" workflow click karo
    ↓
Latest run click karo
    ↓
Live logs dikhenge
```

---

## Step 4.3 — Success Kaisa Dikhega

```
✓ Checkout code
✓ Deploy via SSH
✓ Wait for server to be ready
✓ Health Check
✓ Deployment successful
```

---

## Step 4.4 — Failure Aayi To Kya Karo

**Red X dikhega failed step pe — us step pe click karo logs dekho.**

**Common errors:**

| Error | Fix |
|-------|-----|
| `Permission denied (publickey)` | Public key server ke `authorized_keys` mein check karo |
| `No such file or directory` | `SERVER_PATH` secret check karo — exact path hona chahiye |
| `Health check failed` | Server pe `docker compose ps` run karo, sab containers up hain? |
| `git pull` fails | `GH_PAT` secret check karo — token expire to nahi hua |

---

---

# PART 5 — Aage Se Kaise Kaam Karega

Setup hone ke baad daily workflow:

```bash
# Koi bhi code change karo
git add .
git commit -m "fix: kuch bhi"
git push origin main

# Bus — GitHub Actions automatically:
# 1. Server pe connect hoga
# 2. git pull karega
# 3. docker compose up --build -d karega
# 4. Health check karega
# Deploy ho jayega ~3-4 min mein
```

**GitHub Actions tab mein har deploy ki history bhi milegi.**

---

---

# Quick Reference — Cheez Kahan Milegi

```
SSH Key generate karna     →  Apne computer ki terminal
Public key lagana          →  Server pe ~/.ssh/authorized_keys
Private key copy karna     →  cat ~/.ssh/github_deploy

GitHub PAT banana          →  github.com → Profile → Settings →
                               Developer settings → Personal access tokens →
                               Tokens (classic) → Generate new token (classic)

GitHub Secrets lagana      →  github.com/Al-Khair-IT/SMS →
                               Settings → Secrets and variables →
                               Actions → New repository secret

Deploy monitor karna       →  github.com/Al-Khair-IT/SMS → Actions tab
```
