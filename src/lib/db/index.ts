import { neon, Pool } from '@neondatabase/serverless';
import { drizzle as drizzleHttp } from 'drizzle-orm/neon-http';
import { drizzle as drizzleWs } from 'drizzle-orm/neon-serverless';
import { sql as rawSql } from 'drizzle-orm';
import * as schema from './schema';

const neonSql = neon(process.env.NEON_DATABASE_URL!);
export const db = drizzleHttp(neonSql, { schema });

const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL! });
const wsDb = drizzleWs(pool, { schema });

/**
 * Run a callback within a transaction that has RLS context set.
 * Uses the WebSocket driver for real transaction support so that
 * `SET LOCAL app.current_user_id` persists for the duration of the callback.
 */
export async function withAuth<T>(
	userId: string,
	fn: (tx: typeof db) => Promise<T>,
): Promise<T> {
	return wsDb.transaction(async (tx) => {
		await tx.execute(rawSql`SELECT set_config('app.current_user_id', ${userId}, true)`);
		return fn(tx as unknown as typeof db);
	});
}
