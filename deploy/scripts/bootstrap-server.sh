#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ${EUID} -ne 0 ]]; then
    echo "run bootstrap-server.sh as root" >&2
    exit 1
fi

deploy_user=avito-deploy
deploy_path=/opt/avito-fair-queue
public_key=${AVITO_DEPLOY_SSH_PUBLIC_KEY:-}

if [[ -z "$public_key" ]]; then
    echo "AVITO_DEPLOY_SSH_PUBLIC_KEY is required" >&2
    exit 1
fi

apt-get update
apt-get install -y ca-certificates curl gnupg ufw
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

. /etc/os-release
architecture=$(dpkg --print-architecture)
printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu %s stable\n' \
    "$architecture" "$VERSION_CODENAME" > /etc/apt/sources.list.d/docker.list

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker

if ! id "$deploy_user" >/dev/null 2>&1; then
    useradd --create-home --shell /bin/bash "$deploy_user"
fi
usermod -aG docker "$deploy_user"

deploy_home=$(getent passwd "$deploy_user" | cut -d: -f6)
install -d -m 0700 -o "$deploy_user" -g "$deploy_user" "$deploy_home/.ssh"
authorized_keys="$deploy_home/.ssh/authorized_keys"
touch "$authorized_keys"
if ! grep -Fqx "$public_key" "$authorized_keys"; then
    printf '%s\n' "$public_key" >> "$authorized_keys"
fi
chown "$deploy_user:$deploy_user" "$authorized_keys"
chmod 0600 "$authorized_keys"

install -d -m 0750 -o "$deploy_user" -g "$deploy_user" "$deploy_path"

ufw allow 22/tcp
ufw allow 80/tcp
ufw --force enable
