import net from "node:net";

/**
 * A minimal clamd client (the INSTREAM command over TCP): sends the bytes in length-prefixed chunks and reads the
 * verdict. `scan` resolves with `{ clean: true }` or `{ clean: false, signature }`, and rejects if the daemon cannot
 * be reached or answers oddly — the caller decides to fail closed.
 */
export function clamdScan(content: Buffer, host: string, port: number, timeoutMs = 20_000): Promise<{ clean: true } | { clean: false; signature: string }> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    const chunks: Buffer[] = [];
    const fail = (e: Error) => {
      socket.destroy();
      reject(e);
    };
    socket.setTimeout(timeoutMs, () => fail(new Error("clamd timed out")));
    socket.on("error", fail);
    socket.on("data", (d) => chunks.push(d));
    socket.on("end", () => {
      const reply = Buffer.concat(chunks).toString("utf8").replace(/\0/g, "").trim();
      if (/OK$/.test(reply)) return resolve({ clean: true });
      const m = /stream:\s*(.+)\s+FOUND$/.exec(reply);
      if (m) return resolve({ clean: false, signature: m[1]!.trim() });
      reject(new Error(`unexpected clamd reply: ${reply.slice(0, 120)}`));
    });
    socket.on("connect", () => {
      socket.write("zINSTREAM\0");
      const CHUNK = 64 * 1024;
      for (let o = 0; o < content.length; o += CHUNK) {
        const part = content.subarray(o, Math.min(o + CHUNK, content.length));
        const len = Buffer.alloc(4);
        len.writeUInt32BE(part.length);
        socket.write(len);
        socket.write(part);
      }
      socket.write(Buffer.alloc(4)); // zero-length chunk ends the stream
    });
  });
}
