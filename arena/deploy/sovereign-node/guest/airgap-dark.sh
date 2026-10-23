#!/usr/bin/env bash
# Software air gap for the node guest (run as root). After this:
#   - no default route (on Lima the usernet gateway stays on-link, so
#     deleting the route alone would leave DNS working — hence the rest)
#   - systemd-resolved stopped; /etc/resolv.conf points at 127.0.0.1
#   - nftables: OUTPUT policy drop, loopback + established/related accepted
#     (so management-shell replies survive: `limactl shell` or ssh), every
#     NEW outbound flow refused;
#     FORWARD policy drop closes Docker's bridge even for a container that was
#     NOT started with --network=none.
# Proof is taken afterwards by the rehearsal (`mt-eval node egress-check --json`
# plus curl / getent / bridge-container negatives). "Dark stays dark": there is
# no automatic undo; airgap-light.sh exists for the operator, and the honest
# restore is to delete / re-image the VM.
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "run as root" >&2; exit 2; }

# Deleting the route is not enough on its own: the guest is a DHCP client, and
# the next lease renewal re-installs the default route — the machine then looks
# routed again and `node run-method --assert-airgap` refuses to start (seen
# 2026-09-07, hours into a rehearsal). So the DHCP client is told, first, never
# to install routes or DNS again; the ADDRESS is kept, so `limactl shell`
# survives.
# The interface and gateway are read from the machine (Lima: eth0 via
# 192.168.5.2; a libvirt/multipass/cloud VM: whatever it actually has), and
# saved so airgap-light.sh can restore the real route instead of a guess.
IFACE="$(ip -4 route show default | awk '{print $5; exit}')"
GW="$(ip -4 route show default | awk '{print $3; exit}')"
if [ -n "${IFACE}" ]; then
  printf 'IFACE=%s\nGW=%s\n' "${IFACE}" "${GW}" > /var/lib/champollion-pre-dark-route
else
  # Already dark, or the NAT NIC was detached at the hypervisor: nothing to
  # route through. Keep the first run's record if there was one.
  IFACE="$(sed -n 's/^IFACE=//p' /var/lib/champollion-pre-dark-route 2>/dev/null || true)"
fi

echo "==> stop DHCP from re-installing routes (netplan/networkd drop-in for ${IFACE:-<no default route>})"
if [ -n "${IFACE}" ] && command -v networkctl >/dev/null 2>&1; then
mkdir -p "/etc/systemd/network/10-netplan-${IFACE}.network.d"
cat > "/etc/systemd/network/10-netplan-${IFACE}.network.d/airgap.conf" <<'CONF'
# Written by airgap-dark.sh. The interface keeps its address (the management
# shell rides on it) but the DHCP server may no longer give this machine a way
# out: no routes, no DNS, no gateway.
[DHCPv4]
UseRoutes=false
UseDNS=false
UseGateway=false
[DHCPv6]
UseRoutes=false
UseDNS=false
[Network]
DefaultRouteOnDevice=no
CONF
networkctl reload 2>/dev/null || systemctl reload systemd-networkd 2>/dev/null || true
else
  echo "   (no networkd-managed default interface; the nftables policy below still refuses every new outbound flow)"
fi

echo "==> drop default routes"
ip -4 route del default 2>/dev/null || true
ip -6 route del default 2>/dev/null || true

echo "==> kill DNS"
systemctl stop systemd-resolved 2>/dev/null || true
systemctl mask systemd-resolved 2>/dev/null || true
rm -f /etc/resolv.conf
printf 'nameserver 127.0.0.1\n' > /etc/resolv.conf

# Chain names avoid nft's own statement keywords: a chain called `fwd` is a
# syntax error (nft reads it as the `fwd` verb) and `nft -f` then rejects the
# WHOLE ruleset, leaving the guest with no filtering at all — silently, if the
# caller does not check the exit code. Seen 2026-09-07.
echo "==> nftables: refuse every new outbound flow, close the docker bridge"
nft -f - <<'EOF'
flush ruleset
table inet airgap {
  chain outbound {
    type filter hook output priority 0; policy drop;
    oif "lo" accept
    ct state established,related accept
  }
  chain forwarding {
    type filter hook forward priority 0; policy drop;
  }
}
EOF
systemctl enable nftables 2>/dev/null || true
nft list ruleset > /etc/nftables.conf

date -u +%Y-%m-%dT%H:%M:%SZ > /var/lib/champollion-darkened-at
# Prove it here, in the script that did it, rather than leaving the first
# check to something that runs hours later.
if ip -4 route show default | grep -q .; then
  echo "✗ a default route is STILL present after darkening:" >&2
  ip -4 route show default >&2
  exit 1
fi
echo "==> darkened at $(cat /var/lib/champollion-darkened-at). Verify with: mt-eval node egress-check --json"
