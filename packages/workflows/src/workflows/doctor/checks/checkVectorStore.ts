// apps/cli/src/workflows/doctor/checks/checkVectorStore.ts
import net from "node:net";
import { loadEnvConfig } from "@prsense/config";
import { DoctorCheckResult } from "../../../shared/doctorTypes.js";

export async function checkVectorStore(): Promise<DoctorCheckResult> {
  try {
    const env = loadEnvConfig(process.env);
    const url = new URL(env.PRSENSE_DATABASE_URL);

    await new Promise<void>((resolve, reject) => {
      const socket = net.createConnection(
        Number(url.port) || 5432,
        url.hostname,
      );

      socket.setTimeout(2000);
      socket.on("connect", () => {
        socket.end();
        resolve();
      });
      socket.on("error", reject);
      socket.on("timeout", () => reject(new Error("Timeout")));
    });

    return { status: "ok", name: "Vector database" };
  } catch {
    return {
      status: "fail",
      name: "Vector database",
      message: "Database is not reachable",
      fix: "Ensure Postgres is running and PRSENSE_DATABASE_URL is correct",
    };
  }
}
