import "server-only";
// v7: import from the generated path, not from @prisma/client
// Docs: https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/generating-prisma-client
import { PrismaClient } from "@/generated/prisma/client";

// v7: PrismaClient must receive an adapter — the connection string is configured
// in the adapter, not in schema.prisma.
// Docs: https://www.prisma.io/docs/migrate-to-prisma-v7
function createAdapter() {
	const provider = process.env.DATABASE_PROVIDER ?? "sqlite";
	const url = process.env.DATABASE_URL ?? "file:./dev.db";

	if (provider === "postgresql") {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const { PrismaPg } = require("@prisma/adapter-pg");
		return new PrismaPg({ connectionString: url });
	}

	if (provider === "mysql") {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const { PrismaMariaDb } = require("@prisma/adapter-mariadb");
		// MariaDB adapter accepts host/port/db separately — parse from the URL
		const parsed = new URL(url.replace("mysql://", "http://"));
		return new PrismaMariaDb({
			host: parsed.hostname,
			port: Number(parsed.port) || 3306,
			user: parsed.username,
			password: parsed.password,
			database: parsed.pathname.slice(1),
		});
	}

	// Default: SQLite via better-sqlite3
	// v7: PrismaBetterSqlite3 accepts { url: string } — not a Database instance.
	// Docs: https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7
	// Ensure the url always has the "file:" prefix expected by the adapter.
	const sqliteUrl = url.startsWith("file:") ? url : `file:${url}`;
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
	return new PrismaBetterSqlite3({ url: sqliteUrl });
}

// Singleton pattern — required in Next.js to prevent connection pool exhaustion
// due to hot reload development creating many instances.
// Docs: https://www.prisma.io/docs/orm/more/help-and-troubleshooting/nextjs-help
const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClient | undefined;
};

function createPrismaClient() {
	const client = new PrismaClient({
		adapter: createAdapter(),
		log:
			process.env.NODE_ENV === "development"
				? ["query", "error", "warn"]
				: ["error"],
	});
	// SQLite: enable foreign key enforcement per-connection.
	// Required so cascade delete in the schema (onDelete: Cascade) works.
	// Docs: https://www.sqlite.org/foreignkeys.html
	if ((process.env.DATABASE_PROVIDER ?? "sqlite") === "sqlite") {
		void client.$executeRawUnsafe("PRAGMA foreign_keys = ON").catch(() => {
			// Non-fatal — just log, do not throw
			console.warn("[db] Gagal mengaktifkan foreign_keys pragma");
		});
	}
	return client;
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

// Only store to globalThis in development — in production each deployment
// gets a new instance, which is desired for serverless environments.
if (process.env.NODE_ENV !== "production") {
	globalForPrisma.prisma = db;
}
