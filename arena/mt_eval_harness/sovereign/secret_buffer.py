"""secret_buffer — best-effort-locked, explicitly-zeroed key-material buffer.

The ceremony/restore/unseal paths hold the reconstructed set key ONLY in an
instance of :class:`SecretBuffer`: a mutable ``bytearray`` that is (a)
``mlock(2)``-pinned so the pages are not swapped to disk, best-effort, and
(b) explicitly overwritten with zeros the moment the key is no longer needed
(``close()`` / context-manager exit / interpreter teardown via ``__del__``).

PLATFORM LIMITS — STATED HONESTLY, NOT PAPERED OVER:

* ``mlock`` can fail (RLIMIT_MEMLOCK, unprivileged containers). We report
  that via :attr:`locked` and carry on — a failed lock is a weaker posture,
  never a refusal, and never silently claimed as locked.
* CPython copies: bytes that PASSED THROUGH other objects on the way here
  (file reads, base64 decoding, slicing) may leave unzeroed copies in
  freed interpreter memory, and the ``cryptography`` library makes its own
  internal copies we cannot reach. Zeroing THIS buffer is real but partial.
* The systemic mitigations are operational, and the runbook owns them:
  full-disk encryption (LUKS), swap disabled on the node, and the machine
  itself offline and physically held by the community. This class narrows
  the window; the node's operating discipline is what closes it.
"""

from __future__ import annotations

import ctypes
import sys

__all__ = ["SecretBuffer"]


def _libc():
    if sys.platform.startswith(("linux", "darwin")):
        try:
            return ctypes.CDLL(None, use_errno=True)
        except OSError:
            return None
    return None


class SecretBuffer:
    """Hold ``initial`` in a locked-if-possible, zeroed-on-close buffer.

    If ``initial`` is a ``bytearray`` it is zeroed after copying, so the
    caller's copy does not linger. Use as a context manager::

        with SecretBuffer(raw32) as key:
            do_crypto(key.bytes())
        # buffer is zeroed (and munlocked) here
    """

    def __init__(self, initial: bytes | bytearray):
        if not initial:
            raise ValueError("SecretBuffer needs non-empty key material")
        self._buf = bytearray(initial)
        if isinstance(initial, bytearray):
            initial[:] = b"\x00" * len(initial)
        self._closed = False
        self.locked = False
        self._addr = None
        self._len = len(self._buf)
        libc = _libc()
        if libc is not None:
            # Pin the bytearray's actual storage. The ctypes view is released
            # immediately after we take the address; the address stays valid
            # for the life of self._buf (bytearrays never relocate in-place
            # writes, and we never resize).
            view = (ctypes.c_char * self._len).from_buffer(self._buf)
            self._addr = ctypes.addressof(view)
            del view
            if libc.mlock(ctypes.c_void_p(self._addr),
                          ctypes.c_size_t(self._len)) == 0:
                self.locked = True
            # Failure (e.g. RLIMIT_MEMLOCK) leaves locked=False — reported,
            # not fatal; see the module docstring.

    def bytes(self) -> bytes:
        """An immutable copy for APIs that require ``bytes``. The copy itself
        cannot be zeroed from Python (documented limit) — keep its lifetime
        as short as the call that needs it."""
        if self._closed:
            raise RuntimeError("SecretBuffer is closed (already zeroed)")
        return bytes(self._buf)

    def __len__(self) -> int:
        return self._len

    def close(self) -> None:
        """Zero the buffer and release the memory lock. Idempotent."""
        if self._closed:
            return
        self._buf[:] = b"\x00" * self._len
        libc = _libc()
        if self.locked and libc is not None and self._addr is not None:
            libc.munlock(ctypes.c_void_p(self._addr),
                         ctypes.c_size_t(self._len))
        self.locked = False
        self._closed = True

    @property
    def closed(self) -> bool:
        return self._closed

    def __enter__(self) -> "SecretBuffer":
        return self

    def __exit__(self, *exc) -> None:
        self.close()

    def __del__(self):  # last-resort zeroing; close() is the real contract
        try:
            self.close()
        except Exception:
            pass

    def __repr__(self) -> str:  # never print key material
        state = "closed" if self._closed else (
            "locked" if self.locked else "unlocked")
        return f"<SecretBuffer {self._len} bytes, {state}>"
