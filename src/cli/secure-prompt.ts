export interface SecurePromptInput {
  isTTY?: boolean;
  isRaw?: boolean;
  setRawMode(mode: boolean): unknown;
  setEncoding(encoding: BufferEncoding): unknown;
  resume(): unknown;
  pause(): unknown;
  on(event: "data" | "error", listener: (value: unknown) => void): unknown;
  off(event: "data" | "error", listener: (value: unknown) => void): unknown;
}

export interface SecurePromptOutput {
  isTTY?: boolean;
  write(value: string): unknown;
}

export async function readHiddenInput(
  label: string,
  options: {
    optional?: boolean;
    input?: SecurePromptInput;
    output?: SecurePromptOutput;
  } = {}
): Promise<string> {
  const input = options.input ?? process.stdin;
  const output = options.output ?? process.stdout;
  if (!input.isTTY || !output.isTTY || typeof input.setRawMode !== "function") {
    throw new Error("secure interactive configuration requires a terminal");
  }

  const wasRaw = Boolean(input.isRaw);
  const suffix = options.optional ? ", optional" : "";
  output.write(`${label}: [input hidden${suffix}] `);

  return await new Promise<string>((resolve, reject) => {
    let value = "";
    let settled = false;

    const cleanup = (): void => {
      input.off("data", onData);
      input.off("error", onError);
      try {
        input.setRawMode(wasRaw);
      } finally {
        input.pause();
        output.write("\n");
      }
    };
    const finish = (result?: string, error?: Error): void => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve(result ?? "");
    };
    const onError = (): void => finish(undefined, new Error("secure interactive input failed"));
    const onData = (chunk: unknown): void => {
      for (const char of String(chunk)) {
        if (char === "\r" || char === "\n") {
          finish(value);
          return;
        }
        if (char === "\u0003") {
          finish(undefined, new Error("secure interactive configuration cancelled"));
          return;
        }
        if (char === "\u007f" || char === "\b") {
          value = Array.from(value).slice(0, -1).join("");
          continue;
        }
        if (char >= " " && char !== "\u007f") value += char;
      }
    };

    try {
      input.setEncoding("utf8");
      input.on("data", onData);
      input.on("error", onError);
      input.setRawMode(true);
      input.resume();
    } catch {
      finish(undefined, new Error("secure interactive input failed"));
    }
  });
}
