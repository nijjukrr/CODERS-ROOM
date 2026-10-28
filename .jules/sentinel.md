## 2026-03-30 - Socket Event Input Validation in Real-time Applications
**Vulnerability:** Unsanitized and unvalidated socket event payloads (`roomId`, `username`) accepted directly into Socket.io handlers, allowing non-string or oversized parameters.
**Learning:** WebSocket handlers bypass traditional HTTP express middleware input sanitization, making direct validation inside socket event listeners essential.
**Prevention:** Always validate parameter presence, data types, and length constraints inside Socket.io listeners before processing room attachments or broadcasting.
