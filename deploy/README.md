# Deploying Asset Pro on the IONOS VPS

Asset Pro runs on the same server as PermitHub (Ubuntu 24.04, Node, PostgreSQL 16,
Nginx, PM2, Certbot). It listens on **127.0.0.1:5100** (PermitHub uses 8080) and is
reached through its own Nginx site. It uses no Replit services.

Domain: **mycmms.co.uk** (registered at IONOS; DNS managed in IONOS).

## 1. Export the data from Replit (skip for a fresh start)

Asset Pro has no live users, so this is optional. Skip it to start with the demo data.

In the **Replit Shell** of the Asset Pro project:

```bash
pg_dump "$DATABASE_URL" --no-owner --no-acl > assetpro.sql
ls -lh assetpro.sql
```

Download `assetpro.sql` from the Replit file panel, then from PowerShell on your PC:

```powershell
scp $HOME\Downloads\assetpro.sql jhapphubadmin@217.154.61.211:~
```

## 2. Get the code onto the server

```bash
ssh jhapphubadmin@217.154.61.211
cd ~
git clone https://github.com/scoobz72/asset-pro.git assetpro
cd assetpro
git checkout move-off-replit
```

(It is a private repo: use the same GitHub sign-in or deploy key you use for PermitHub.)

## 3. Create the database and load the Replit data

```bash
DBPASS="$(openssl rand -hex 16)"; echo "DB password: $DBPASS"
sudo -u postgres psql -c "CREATE USER assetpro WITH PASSWORD '$DBPASS';"
sudo -u postgres psql -c "CREATE DATABASE assetpro OWNER assetpro;"
# Only if you exported the Replit data in step 1:
# psql "postgresql://assetpro:$DBPASS@localhost:5432/assetpro" -v ON_ERROR_STOP=1 -f ~/assetpro.sql
```

The app starts with no data: on first start it creates your platform admin account
(step 4), and you create each customer company from the **Companies** page.

## 4. Settings

```bash
cp deploy/env.example .env
chmod 600 .env
sed -i "s/YOUR_DB_PASSWORD/$DBPASS/" .env
sed -i "s/^SESSION_SECRET=.*/SESSION_SECRET=$(openssl rand -hex 32)/" .env
nano .env     # check it
```

In `.env`, set `ADMIN_EMAIL`, `ADMIN_NAME` and `ADMIN_BOOTSTRAP_PASSWORD` (8+ characters).
On first start this creates the "MyCMMS HQ" company with you as platform admin. After you
have signed in, remove the `ADMIN_BOOTSTRAP_PASSWORD` line and run
`pm2 restart assetpro --update-env`.

## 5. Build and start

```bash
bash deploy/deploy.sh
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5100/    # expect 200
pm2 logs assetpro --lines 30
```

## 6. Nginx

```bash
sudo cp deploy/nginx-assetpro.conf /etc/nginx/sites-available/assetpro
sudo ln -sf /etc/nginx/sites-available/assetpro /etc/nginx/sites-enabled/assetpro
sudo nginx -t && sudo systemctl reload nginx
```

## 7. DNS and HTTPS

In IONOS DNS for mycmms.co.uk, point the `@` and `www` **A records** at
`217.154.61.211` and remove any parking or AAAA records.
When `ping mycmms.co.uk` shows the new IP:

```bash
sudo certbot --nginx -d mycmms.co.uk -d www.mycmms.co.uk
```

Sign in and check it works, then stop the Replit deployment.

## Companies and users

- **You (platform admin):** Companies page → New company creates the company and its first
  Manager with a temporary password. Requests from the home page's "Request access" form
  appear at the top of the same page. Suspending a company signs its users out.
- **Company Managers/Admins:** Team page → Add Member, or ⋮ → Edit role / reset password.
- Each email address can belong to only one company.

## Updates

```bash
cd ~/assetpro && bash deploy/deploy.sh
```

## Backups

Add to `crontab -e`:

```
30 2 * * * /home/jhapphubadmin/assetpro/deploy/backup.sh >> /home/jhapphubadmin/backups/backup.log 2>&1
```
