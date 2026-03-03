/**
 * seed-menus.mjs
 *
 * Bulk-inserts a full year of menu data (2026-01-01 → 2026-12-31) into the
 * Supabase `menus` table by repeating a 7-day weekly template.
 *
 * ── Requirements ──────────────────────────────────────────────────────────────
 *  1. Copy .env.seed.example → .env.seed and fill in SUPABASE_SERVICE_ROLE_KEY
 *  2. Run:  node scripts/seed-menus.mjs
 *
 * ── Safety notes ──────────────────────────────────────────────────────────────
 *  • Uses UPSERT (onConflict: 'date,meal_type') — safe to re-run.
 *  • Calls Supabase directly (NOT menuService.upsertMenu), so NO
 *    auto-announcements are created for bulk-inserted rows.
 *  • Only manual admin edits through the UI will generate announcements.
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { addDays, format, getDay } from 'date-fns';

// ── Config ────────────────────────────────────────────────────────────────────
const START_DATE = '2026-01-01';
const TOTAL_DAYS = 365;
const BATCH_SIZE = 100;
const CSV_FILE = 'weekly_menu_template.csv';

// ── Resolve __dirname for ESM ─────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Load .env.seed ────────────────────────────────────────────────────────────
function loadEnvSeed() {
    const envPath = join(__dirname, '..', '.env.seed');
    let envText;
    try {
        envText = readFileSync(envPath, 'utf8');
    } catch {
        console.error('\n❌  Could not read .env.seed file.');
        console.error(
            '   Create it at the project root with:\n' +
            '   SUPABASE_URL=https://oyyizheqxjorjvjanuqk.supabase.co\n' +
            '   SUPABASE_SERVICE_ROLE_KEY=<your service_role key>\n'
        );
        process.exit(1);
    }

    const env = {};
    for (const line of envText.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const idx = trimmed.indexOf('=');
        if (idx === -1) continue;
        const key = trimmed.slice(0, idx).trim();
        const value = trimmed.slice(idx + 1).trim();
        env[key] = value;
    }
    return env;
}

// ── Parse CSV ─────────────────────────────────────────────────────────────────
function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    const [header, ...rows] = lines;
    const keys = header.split(',');

    return rows.map((row) => {
        // Split on commas that are NOT inside quotes
        const values = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < row.length; i++) {
            const ch = row[i];
            if (ch === '"') {
                inQuotes = !inQuotes;
            } else if (ch === ',' && !inQuotes) {
                values.push(current);
                current = '';
            } else {
                current += ch;
            }
        }
        values.push(current);

        const obj = {};
        keys.forEach((k, i) => (obj[k.trim()] = (values[i] || '').trim()));
        return obj;
    });
}

// ── Build weekly template ─────────────────────────────────────────────────────
function buildTemplate(csvRows) {
    const template = {};
    for (const row of csvRows) {
        const day = row.weekday.toLowerCase();
        const meal = row.meal_type.toLowerCase();
        // Convert literal "\n" strings in CSV → real newlines
        const items = row.items.replace(/\\n/g, '\n');
        if (!template[day]) template[day] = {};
        template[day][meal] = items;
    }
    return template;
}

// ── Day index → weekday name (date-fns getDay: 0=Sun, 1=Mon … 6=Sat) ─────────
const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// ── Generate all rows ─────────────────────────────────────────────────────────
function generateRows(template) {
    const rows = [];
    const startDate = new Date(START_DATE + 'T00:00:00');
    const MEALS = ['breakfast', 'lunch', 'dinner'];

    for (let i = 0; i < TOTAL_DAYS; i++) {
        const date = addDays(startDate, i);
        const dayName = DAY_NAMES[getDay(date)];
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayTemplate = template[dayName];

        if (!dayTemplate) {
            console.warn(`⚠️  No template found for weekday: ${dayName} (date: ${dateStr})`);
            continue;
        }

        for (const meal of MEALS) {
            const items = dayTemplate[meal];
            if (!items) {
                console.warn(`⚠️  No items for ${dayName} ${meal}`);
                continue;
            }
            rows.push({ date: dateStr, meal_type: meal, items });
        }
    }
    return rows;
}

// ── Chunk array into batches ──────────────────────────────────────────────────
function chunk(arr, size) {
    const batches = [];
    for (let i = 0; i < arr.length; i += size) {
        batches.push(arr.slice(i, i + size));
    }
    return batches;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
    console.log('\n🌱  MessFlow — Bulk Menu Seeder');
    console.log('━'.repeat(50));

    // 1) Load env
    const env = loadEnvSeed();
    const SUPABASE_URL = env.SUPABASE_URL;
    const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error('❌  SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in .env.seed');
        process.exit(1);
    }

    // 2) Init Supabase client with service role (bypasses RLS)
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: false },
    });

    // 3) Read and parse CSV
    const csvPath = join(__dirname, CSV_FILE);
    let csvText;
    try {
        csvText = readFileSync(csvPath, 'utf8');
    } catch {
        console.error(`❌  Could not read CSV: ${csvPath}`);
        process.exit(1);
    }

    const csvRows = parseCSV(csvText);
    console.log(`📄  Parsed ${csvRows.length} rows from ${CSV_FILE}`);

    const template = buildTemplate(csvRows);
    const days = Object.keys(template);
    console.log(`📅  Template covers weekdays: ${days.join(', ')}`);

    // 4) Generate rows
    const rows = generateRows(template);
    console.log(`\n📊  Generated ${rows.length} menu rows for ${TOTAL_DAYS} days (${START_DATE} → ${format(addDays(new Date(START_DATE + 'T00:00:00'), TOTAL_DAYS - 1), 'yyyy-MM-dd')})`);
    console.log(`     Expected: ${TOTAL_DAYS * 3} rows | Got: ${rows.length} rows`);

    // 5) Upsert in batches
    const batches = chunk(rows, BATCH_SIZE);
    console.log(`\n⬆️   Upserting ${batches.length} batches of up to ${BATCH_SIZE} rows each…\n`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        process.stdout.write(`   Batch ${String(i + 1).padStart(2, '0')}/${batches.length} (${batch.length} rows)… `);

        const { error } = await supabase
            .from('menus')
            .upsert(batch, { onConflict: 'date,meal_type' });

        if (error) {
            console.log('❌ FAILED');
            console.error(`   Error: ${error.message}`);
            errorCount += batch.length;
        } else {
            console.log('✅ OK');
            successCount += batch.length;
        }
    }

    // 6) Summary
    console.log('\n' + '━'.repeat(50));
    console.log(`✅  Succeeded: ${successCount} rows`);
    if (errorCount > 0) {
        console.log(`❌  Failed:    ${errorCount} rows`);
    }
    console.log('\n🔍  Verification SQL (run in Supabase SQL Editor):');
    console.log('');
    console.log("   -- Total count (should be 1095)");
    console.log("   SELECT COUNT(*) FROM menus WHERE date BETWEEN '2026-01-01' AND '2026-12-31';");
    console.log('');
    console.log("   -- Spot-check a Sunday (2026-03-15)");
    console.log("   SELECT date, meal_type, items FROM menus WHERE date = '2026-03-15' ORDER BY meal_type;");
    console.log('');
    console.log("   -- Verify weekly repeat (three consecutive Mondays)");
    console.log("   SELECT date, meal_type, items FROM menus");
    console.log("   WHERE meal_type = 'breakfast'");
    console.log("     AND date IN ('2026-01-05','2026-01-12','2026-01-19')");
    console.log("   ORDER BY date;");
    console.log('');

    if (errorCount > 0) process.exit(1);
}

main().catch((err) => {
    console.error('\n💥  Unexpected error:', err);
    process.exit(1);
});
