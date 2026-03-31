import { prismaExtension } from "@trigger.dev/build/extensions/prisma";
import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
	project: "proj_awglkahludtkmhpstqlb",
	runtime: "node",
	logLevel: "log",
	// The max compute seconds a task is allowed to run. If the task run exceeds this duration, it will be stopped.
	// You can override this on an individual task.
	// See https://trigger.dev/docs/runs/max-duration
	maxDuration: 3600,
	retries: {
		enabledInDev: false,
		default: {
			maxAttempts: 3,
			minTimeoutInMs: 1000,
			maxTimeoutInMs: 10000,
			factor: 2,
			randomize: true,
		},
	},
	dirs: ["./src/trigger"],

	// Build config — ensure the path alias @/ resolves correctly
	build: {
		conditions: ["react-server"],
		extensions: [prismaExtension({ mode: "modern" })],
	},
});
