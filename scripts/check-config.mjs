import { configurationReport } from "../lib/server/config.js";

const report = configurationReport();
if (report.ready) {
  console.log("Grove backend configuration is ready for provider staging.");
} else {
  console.error("Grove backend configuration is incomplete:");
  for (const item of report.missing) console.error(`- ${item}`);
  process.exitCode = 1;
}
