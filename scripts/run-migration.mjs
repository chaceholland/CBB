import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://postgres.dtnozcqkuzhjmjvsfjqk:Mchdsudmi12%40@aws-0-us-east-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false },
});

const SQL = `
ALTER TABLE cbb_pitchers
  ADD COLUMN IF NOT EXISTS position text,
  ADD COLUMN IF NOT EXISTS year text,
  ADD COLUMN IF NOT EXISTS height text,
  ADD COLUMN IF NOT EXISTS weight text,
  ADD COLUMN IF NOT EXISTS hometown text,
  ADD COLUMN IF NOT EXISTS bats_throws text;

ALTER TABLE cbb_teams
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS abbreviation text;
`;

try {
  await client.connect();
  console.log('Connected to Supabase PostgreSQL');
  await client.query(SQL);
  console.log('✅ Migration complete');

  // Verify columns exist
  const res = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'cbb_pitchers'
    AND column_name IN ('position','year','height','weight','hometown','bats_throws')
    ORDER BY column_name;
  `);
  console.log('cbb_pitchers new columns:', res.rows.map(r => r.column_name).join(', '));

  const res2 = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'cbb_teams'
    AND column_name IN ('slug','abbreviation')
    ORDER BY column_name;
  `);
  console.log('cbb_teams new columns:', res2.rows.map(r => r.column_name).join(', '));
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
} finally {
  await client.end();
}
