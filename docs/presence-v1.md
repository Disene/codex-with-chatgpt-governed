# Presence V1

Presence V1 decides where a future Human Gate notification should be routed. It never grants, denies, or bypasses a Human Gate.

## Modes

- `AUTO` — resolve from read-only macOS signals.
- `PRESENT` — manual override; treat the Human as at the computer.
- `AWAY` — manual override; treat the Human as away.

`AUTO` resolves to `PRESENT`, `AWAY`, or `UNKNOWN`.

## macOS signals

V1 uses two local read-only `ioreg` probes:

1. `IOConsoleUsers` / `CGSSessionScreenIsLocked` for screen-lock state.
2. `IOHIDSystem.HIDIdleTime` for time since keyboard/mouse activity.

The default away threshold is 10 minutes. A locked screen is immediately `AWAY`. Idle time at or above the threshold is `AWAY`. `PRESENT` requires both an explicitly unlocked session and idle time below the threshold. Missing or unsupported signals resolve to `UNKNOWN`.

There is no camera, keystroke-content capture, app-content inspection, background daemon, polling loop, or notification in this PR.

## Persistence

Only the selected mode is persisted as the optional `presenceMode` field in the existing Governance sidecar state. Existing state files without the field behave as `AUTO`.

## Safety boundary

Presence controls notification routing only. A wrong presence result must never authorize an action or change Human Gate validity.
