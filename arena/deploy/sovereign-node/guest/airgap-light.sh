#!/usr/bin/env bash
# Operator restore for a darkened guest (run as root). Exists so a rehearsal can
# be re-provisioned without a full `limactl delete`; a node that has held real
# shares or plaintext should NOT be re-lit — delete it. This script says so.
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "run as root" >&2; exit 2; }
echo "WARNING: re-lighting a node that has held custodian shares or plaintext refs"
echo "         defeats the point of the gap. For anything but a throwaway rehearsal, delete / re-image the VM"
nft flush ruleset || true
rm -f /etc/nftables.conf
systemctl unmask systemd-resolved 2>/dev/null || true
systemctl start systemd-resolved 2>/dev/null || true
ln -sf /run/systemd/resolve/stub-resolv.conf /etc/resolv.conf
# The route airgap-dark.sh saved (Lima: eth0 via 192.168.5.2); DHCP also
# re-adds it on the next lease once the drop-in is gone.
if [ -f /var/lib/champollion-pre-dark-route ]; then
  # shellcheck disable=SC1091
  . /var/lib/champollion-pre-dark-route
  rm -f "/etc/systemd/network/10-netplan-${IFACE}.network.d/airgap.conf"
  networkctl reload 2>/dev/null || true
  [ -n "${GW:-}" ] && ip -4 route add default via "${GW}" dev "${IFACE}" 2>/dev/null || true
fi
rm -f /var/lib/champollion-darkened-at
echo "re-lit; run guest/verify-guest.sh to confirm connectivity"
