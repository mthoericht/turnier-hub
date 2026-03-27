# Ansible deployment (production)

Layout (short):

- `inventory/` — copy `hosts.example.ini` → `hosts.ini`
- `group_vars/` — copy `all.yml.example` → `all.yml` (secrets; prefer Vault)
- `playbooks/` — `bootstrap.yml`, `deploy.yml`, `restart.yml`
- `roles/turnier_hub/` — tasks (`bootstrap`, `deploy`, `restart`, `preflight`, `systemd`, `healthcheck`), templates (`server.env.j2`, systemd units)

This folder provides a production workflow for Turnier-Hub with three playbooks:

- `playbooks/bootstrap.yml`: first-time setup (clone, install, env, build, DB deploy, restart)
- `playbooks/deploy.yml`: update + deploy (pull, install, build, DB deploy, restart)
- `playbooks/restart.yml`: restart only

## What to adjust before first run

### 0) Prerequisites

On the control machine:

- Ansible installed
- SSH access to target host

On the target host:

- Node.js and npm installed
- access to clone your repository (SSH key/token depending on repo URL)
- a running process manager target (`systemd`, `pm2`, or `custom`)

### 1) Create local inventory and variable files

```bash
cp ansible/inventory/hosts.example.ini ansible/inventory/hosts.ini
cp ansible/group_vars/all.yml.example ansible/group_vars/all.yml
```

### 2) Configure target host (`ansible/inventory/hosts.ini`)

Set at least:

- host/IP (`ansible_host`)
- SSH user (`ansible_user`)

Example:

```ini
[app]
prod-1 ansible_host=203.0.113.10 ansible_user=deploy
```

### 3) Configure production variables (`ansible/group_vars/all.yml`)

You must set:

- `turnier_hub_repo_url`
- `turnier_hub_repo_branch`
- `turnier_hub_app_user`
- `turnier_hub_app_group`
- `turnier_hub_app_dir`
- `turnier_hub_process_manager` (`systemd`, `pm2`, `custom`)
- `turnier_hub_env.DATABASE_URL`
- `turnier_hub_env.JWT_SECRET`
- `turnier_hub_env.INVITE_CODE`

Optional but recommended:

- `turnier_hub_manage_systemd_unit` (default `true`)
- `turnier_hub_systemd_service` (default `turnier-hub`)
- `turnier_hub_healthcheck_enabled` (default `true`)
- `turnier_hub_healthcheck_url` (default `http://127.0.0.1:3001/api/health`)
- `turnier_hub_healthcheck_status` (default `200`)

Optional Prisma Studio (systemd):

- `turnier_hub_prisma_studio_enabled` (default `false` in role defaults; example enables it)
- `turnier_hub_manage_prisma_studio_systemd_unit` (default `true`)
- `turnier_hub_prisma_studio_systemd_service` (default `turnier-hub-prisma-studio`)
- `turnier_hub_prisma_studio_host` / `turnier_hub_prisma_studio_port` (defaults bind to `127.0.0.1:5555`)

## How to run in production (step by step)

### 4) First-time setup on a new host

Run:

```bash
ansible-playbook -i ansible/inventory/hosts.ini ansible/playbooks/bootstrap.yml
```

This will:

1. validate required vars/secrets
2. create app user/group and app directory
3. optionally install/update systemd unit
4. clone/update repository
5. install dependencies (`npm ci`)
6. write `server/.env` from `turnier_hub_env`
7. run `npm run db:deploy`
8. run `npm run prod:prepare`
9. restart app
10. run health check

**Database:** `npm run db:deploy` runs Prisma `db push` against `DATABASE_URL` from `server/.env`. For **SQLite**, this creates the database file on disk if it does not exist yet and applies the schema. The playbooks also ensure `{{ turnier_hub_app_dir }}/data/` exists so default `DATABASE_URL` paths like `file:../../data/prod.db` work. It does **not** run seed data — use `npm run db:seed` manually only if you explicitly want demo data (not recommended for production).

**Prisma Studio dependency:** the server installs the `prisma` CLI as a devDependency. These playbooks use `npm ci` (full install). If you later switch to `npm ci --omit=dev`, Prisma Studio will not be available unless you adjust dependencies or the install command.

### 5) Regular update + deploy

Run:

```bash
ansible-playbook -i ansible/inventory/hosts.ini ansible/playbooks/deploy.yml
```

This will pull latest code and redeploy. Restart is handler-based and only triggered when relevant changes occurred.

### 6) Restart only

Run:

```bash
ansible-playbook -i ansible/inventory/hosts.ini ansible/playbooks/restart.yml
```

When `turnier_hub_prisma_studio_enabled` is `true` and you use **systemd**, this playbook also **restarts the Prisma Studio service** after the API service.

## Safety and behavior

- Placeholder secrets (`CHANGE_ME`, etc.) fail the playbook early.
- Health check runs after restart/deploy if enabled.
- Generated env file path: `{{ turnier_hub_app_dir }}/server/.env`.
- systemd unit template path: `ansible/roles/turnier_hub/templates/turnier-hub.service.j2`.
- Prisma Studio unit template: `ansible/roles/turnier_hub/templates/turnier-hub-prisma-studio.service.j2`.
- Prisma Studio is powerful and should not be exposed publicly. Default bind is **localhost**; access via SSH port forwarding if needed.

## Recommended production practice

- Store `ansible/group_vars/all.yml` secrets with **Ansible Vault**.
- Pin deployment to a tag/commit via variables when releasing.
- Keep `turnier_hub_healthcheck_url` aligned with your actual API endpoint.
- Keep Prisma Studio disabled in production unless you have a clear operational need and network controls.
