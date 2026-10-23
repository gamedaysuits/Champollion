"""sovereign — the sovereign-eval execution layer (threshold custody lane).

Implements the LOCAL-NODE half of the sovereign multisig plan
(mechanisms M1/M2/M4, build Phases 2–4) and the operational spec published at
cli/website/docs/network/sovereignty/sovereign-eval-node.md:

  shamir_gf256    M-of-N secret sharing over GF(256) (vendored, property-tested)
  secret_buffer   best-effort-locked, explicitly-zeroed key-material buffer
  threshold_seal  the seal.mjs envelope (X25519+HKDF+AES-256-GCM) in Python —
                  seal/open + Ed25519 sign/verify, format-identical so a
                  ceremony changes WHO holds the key, never the ciphertext
  ceremony        `mt-eval node ceremony init|share|verify|restore`
  local_ledger    hash-chained, append-only authorization ledger (the
                  migration-040 design, Supabase-free for the air gap)
  sealed_run      quorum-gated unseal INSIDE the executor run context only
  score_manifest  signed score manifests + `mt-eval node verify-manifest`
  airgap_ops      offline install bundle, IN/OUT drive manifests, egress check

HONESTY CONTRACT (read before extending):

* This lane is Shamir SECRET SHARING with reconstruction IN EXECUTOR MEMORY,
  not TSS/MPC threshold *signing*. During an authorized run the set key briefly
  exists, assembled, in the memory of the community-controlled offline node.
  The sandbox spec §12.5 rejects exactly this for the NETWORKED platform —
  there, the key must never assemble anywhere Champollion operates. On a
  sovereign node the machine itself is the community's, offline, physically
  held; the properties defended are "no standing key on disk", "no run without
  a quorum of custodian shares physically presented", and "every use chained
  into a tamper-evident local ledger". Say it that way; never call this MPC.
* Hardware TEE attestation is NOT claimed anywhere in this package.
* Share presentation is NOT bound to a specific run. A quorum authorizes by
  presenting M shares at that instant; there is no per-run challenge each
  custodian's share signs. A node that RETAINS share copies after a sitting
  could re-run without the custodians reconvening — mitigated by the offline,
  community-held machine and the tamper-evident ledger, not by a cryptographic
  challenge-response (that is the Wave-2 threshold-signing upgrade). The gate
  authenticates SHARES, not identities: it enforces M distinct custodians and
  set-identity binding (sealed_run.quorum_unseal_for_run), but "the right
  people" is a custody/governance property, not one the node can verify.
* The `cryptography` library provides every primitive (AEAD, HKDF, X25519,
  Ed25519). Nothing cryptographic is hand-rolled except the vendored,
  property-tested GF(256) Shamir arithmetic, which is information-theoretic
  secret sharing, not a cipher.
"""
