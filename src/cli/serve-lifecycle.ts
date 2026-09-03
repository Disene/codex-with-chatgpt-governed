import { startBridge, type Bridge, type BridgeOptions } from "../bridge/server.js";
import { startGateNotificationWatcher } from "../governance/notifications/index.js";

export interface ServeLifecycle {
  bridge: Bridge;
  shutdown(): Promise<void>;
}

export interface ServeLifecycleDeps {
  startBridge?: typeof startBridge;
  startWatcher?: typeof startGateNotificationWatcher;
}

/** Compose the bridge and notification watcher behind one ordered, idempotent shutdown. */
export async function startServeLifecycle(
  options: BridgeOptions,
  deps: ServeLifecycleDeps = {}
): Promise<ServeLifecycle> {
  const bridge = await (deps.startBridge ?? startBridge)(options);
  let watcher: ReturnType<typeof startGateNotificationWatcher>;
  try {
    watcher = (deps.startWatcher ?? startGateNotificationWatcher)({
      workspaceId: bridge.workspace.id,
      workspaceName: bridge.workspace.name,
      logger: options.logger,
    });
  } catch (error) {
    await bridge.close();
    throw error;
  }

  let shutdownPromise: Promise<void> | null = null;
  return {
    bridge,
    shutdown(): Promise<void> {
      if (!shutdownPromise) {
        watcher.stop();
        shutdownPromise = bridge.close();
      }
      return shutdownPromise;
    },
  };
}
