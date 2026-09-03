import {
  feishuConfigSummary,
  writeGlobalFeishuConfig,
} from "../governance/notifications/config.js";
import { readHiddenInput } from "./secure-prompt.js";

export interface ConfigureNotificationsDeps {
  prompt?: typeof readHiddenInput;
  writeConfig?: typeof writeGlobalFeishuConfig;
}

/** Keep credentials inside the interactive setup seam and return only a redacted summary. */
export async function configureGlobalFeishuNotifications(
  deps: ConfigureNotificationsDeps = {}
): Promise<ReturnType<typeof feishuConfigSummary>> {
  const prompt = deps.prompt ?? readHiddenInput;
  const webhookUrl = await prompt("Webhook URL");
  const secret = await prompt("Signing Secret", { optional: true });
  const config = (deps.writeConfig ?? writeGlobalFeishuConfig)({ webhookUrl, secret });
  return feishuConfigSummary(config);
}
