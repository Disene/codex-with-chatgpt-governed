# Notification Runtime V1

Notification Runtime V1 routes an already-created, still-waiting Human Gate to Feishu when the Human is away. Feishu is notification-only: it cannot grant, deny, consume, or otherwise change authorization.

## Routing

The reusable watcher evaluates only while `gate.status === "WAITING"`.

- `PRESENT` -> no Feishu message.
- `AWAY` -> send one Feishu message immediately.
- `UNKNOWN` -> send only after 3 continuous minutes of uncertainty.
- `PRESENT -> AWAY` while the same Gate is still waiting -> backfill one Feishu message.
- successful Feishu delivery is deduplicated by `gateId`.
- failed delivery uses a 5-minute retry backoff instead of retrying every watcher tick.
- a new Gate gets a fresh notification lifecycle.

The watcher interval defaults to 30 seconds and its timer is `unref()`'d. Presence is not sampled when no Gate is waiting.

## Secrets

Webhook URL and optional signing secret are stored separately under the OS C2C state directory using the existing owner-only JSON writer (`0600`). They are not stored in the repository, Governance state, execution records, or notification content.

Only HTTPS Feishu/Lark custom-bot webhook hosts are accepted.

## Message content

The mobile notification contains only:

- workspace name
- requested action
- environment
- up to three target names
- waiting status
- a ChatGPT link when one is known

It does not include diffs, logs, credentials, webhook URLs, or signing secrets.

## Security boundary

Presence and notification routing never authorize execution. The notification explicitly tells the Human to return to ChatGPT to review and authorize.

This PR provides routing, secure configuration, Feishu delivery, retry/deduplication, and the reusable watcher. A following integration change will connect Human Gate creation/authorization UX to CLI/Skill and start/stop the watcher from the existing Bridge lifecycle.
