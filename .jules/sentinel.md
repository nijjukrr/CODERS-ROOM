## 2026-03-30 - Socket Event Input Validation in Real-time Applications
**Vulnerability:** Unsanitized and unvalidated socket event payloads (`roomId`, `username`) accepted directly into Socket.io handlers, allowing non-string or oversized parameters.
**Learning:** WebSocket handlers bypass traditional HTTP express middleware input sanitization, making direct validation inside socket event listeners essential.
**Prevention:** Always validate parameter presence, data types, and length constraints inside Socket.io listeners before processing room attachments or broadcasting.

## 2026-03-31 - Cross-Room Socket Authorization Bypass
**Vulnerability:** Connected sockets could emit `CODE_CHANGE` to rooms they never joined and send arbitrary `SYNC_CODE` events to arbitrary socket IDs without room membership.
**Learning:** Real-time event handlers must enforce authorization by verifying `socket.rooms.has(roomId)` or verifying shared room membership before relaying state or messages between sockets.
**Prevention:** Check socket membership against room identifiers on every mutating or broadcasting socket event, and place payload size limits on transmitted code buffers.
