# GymFlow heartbeat

On each scheduled heartbeat:

1. Run `/usr/local/bin/gymflow-status --json`.
2. If healthy, do not send a message unless a daily summary was explicitly requested.
3. If unhealthy, confirm only with bounded, read-only checks. Never include secrets or raw customer data.
4. Report a concise incident summary to the allowlisted Telegram operator.
5. Do not remediate automatically. Propose the safest reversible action and wait for explicit approval.

The independent systemd monitor is responsible for minute-by-minute alerts and recovery notifications even when OpenClaw is down.
