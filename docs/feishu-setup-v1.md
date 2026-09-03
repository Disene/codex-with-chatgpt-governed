# Feishu Local Setup V1

Governed C2C can keep one machine-wide Feishu/Lark custom-bot configuration outside project repositories. An existing workspace-specific configuration remains compatible and takes precedence over the machine default.

```bash
c2c governance notifications status
c2c governance notifications configure
c2c governance notifications test
c2c governance notifications clear
```

`configure` accepts the Webhook URL and optional signing secret only through hidden input in an interactive terminal. It does not accept either credential as a command-line argument, and credentials must never be pasted into chat or GitHub. The configuration is stored under the local C2C state directory with an owner-only directory and a `0600` file. Signing remains optional at the code level; `status` makes the effective signed/unsigned state explicit.

`status` reports only whether the effective configuration is configured, enabled, signed, and whether it came from the machine default or current workspace. It never prints the Webhook URL or signing secret.

`test` sends one notify-only connectivity message through the same validated and optionally signed transport used by Gate notifications. It neither creates nor changes a Human Gate, and the Feishu message cannot authorize an action. `clear` removes only the machine-wide default and is safe to repeat.
