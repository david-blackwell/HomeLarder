const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

const DATA_DIR = process.env.DATA_DIR || '/data';
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_NAME = process.env.DB_NAME || 'pantry.db';
const db = new Database(path.join(DATA_DIR, DB_NAME));

db.exec(`
  CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    icon TEXT DEFAULT '📦',
    color TEXT DEFAULT '#6366f1',
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    icon TEXT DEFAULT '📦',
    color TEXT DEFAULT '#6366f1',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category_id INTEGER,
    location_id INTEGER,
    notes TEXT,
    quantity TEXT,
    quantity_num REAL,
    date_added TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS sub_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    quantity TEXT,
    quantity_num REAL,
    date_added TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tab_presets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    tabs TEXT NOT NULL DEFAULT '[]',
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

`);

// Seed defaults only on very first run (empty tables) — won't re-add deleted items
if (db.prepare('SELECT COUNT(*) as c FROM categories').get().c === 0) {
  db.prepare("INSERT INTO categories (name,icon,color) VALUES (?,?,?)").run('Produce','🥦','#22c55e');
  db.prepare("INSERT INTO categories (name,icon,color) VALUES (?,?,?)").run('Dairy','🧀','#eab308');
  db.prepare("INSERT INTO categories (name,icon,color) VALUES (?,?,?)").run('Meat & Fish','🥩','#ef4444');
  db.prepare("INSERT INTO categories (name,icon,color) VALUES (?,?,?)").run('Leftovers','🍱','#f97316');
  db.prepare("INSERT INTO categories (name,icon,color) VALUES (?,?,?)").run('Frozen','🧊','#38bdf8');
  db.prepare("INSERT INTO categories (name,icon,color) VALUES (?,?,?)").run('Pantry Staples','🫙','#a78bfa');
  db.prepare("INSERT INTO categories (name,icon,color) VALUES (?,?,?)").run('Spices & Herbs','🌿','#10b981');
  db.prepare("INSERT INTO categories (name,icon,color) VALUES (?,?,?)").run('Drinks','🥤','#06b6d4');
  db.prepare("INSERT INTO categories (name,icon,color) VALUES (?,?,?)").run('Snacks','🍿','#f59e0b');
  db.prepare("INSERT INTO categories (name,icon,color) VALUES (?,?,?)").run('Condiments','🫙','#84cc16');
}
if (db.prepare('SELECT COUNT(*) as c FROM locations').get().c === 0) {
  db.prepare("INSERT INTO locations (name,icon,color,sort_order) VALUES (?,?,?,?)").run('Fridge','❄️','#1e5f8a',0);
  db.prepare("INSERT INTO locations (name,icon,color,sort_order) VALUES (?,?,?,?)").run('Freezer','🧊','#5b8cba',1);
  db.prepare("INSERT INTO locations (name,icon,color,sort_order) VALUES (?,?,?,?)").run('Pantry','🫙','#c85a2a',2);
  db.prepare("INSERT INTO locations (name,icon,color,sort_order) VALUES (?,?,?,?)").run('Spice Rack','🌿','#10b981',3);
  db.prepare("INSERT INTO locations (name,icon,color,sort_order) VALUES (?,?,?,?)").run('Fruit Bowl','🍎','#f59e0b',4);
}

// Migrate: add quantity_num column to sub_entries if missing
try {
  const seCols = db.prepare("PRAGMA table_info(sub_entries)").all().map(c => c.name);
  if (!seCols.includes('quantity_num')) db.exec('ALTER TABLE sub_entries ADD COLUMN quantity_num REAL');
} catch (e) {}

// Migrate: add quantity columns to items if missing
try {
  const iCols = db.prepare("PRAGMA table_info(items)").all().map(c => c.name);
  if (!iCols.includes('quantity')) db.exec('ALTER TABLE items ADD COLUMN quantity TEXT');
  if (!iCols.includes('quantity_num')) db.exec('ALTER TABLE items ADD COLUMN quantity_num REAL');
} catch (e) {}

// Migrate old text-based location column if upgrading from v1
try {
  const cols = db.prepare("PRAGMA table_info(items)").all().map(c => c.name);
  if (cols.includes('location') && !cols.includes('location_id')) {
    db.exec(`ALTER TABLE items ADD COLUMN location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL`);
    const locs = db.prepare('SELECT * FROM locations').all();
    const locMap = {};
    locs.forEach(l => { locMap[l.name.toLowerCase()] = l.id; });
    const oldItems = db.prepare('SELECT id, location FROM items WHERE location IS NOT NULL').all();
    const update = db.prepare('UPDATE items SET location_id = ? WHERE id = ?');
    for (const item of oldItems) {
      const lid = locMap[item.location?.toLowerCase()];
      if (lid) update.run(lid, item.id);
    }
  }
} catch (e) { /* fresh DB or already migrated */ }

// ── Locations ──────────────────────────────────────────────────────────────
app.get('/api/locations', (req, res) => {
  res.json(db.prepare('SELECT * FROM locations ORDER BY sort_order ASC, name ASC').all());
});

app.post('/api/locations', (req, res) => {
  const { name, icon, color } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  try {
    const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order),0) as m FROM locations').get().m;
    const result = db.prepare('INSERT INTO locations (name, icon, color, sort_order) VALUES (?, ?, ?, ?)').run(
      name.trim(), icon || '📦', color || '#6366f1', maxOrder + 1
    );
    res.json(db.prepare('SELECT * FROM locations WHERE id = ?').get(result.lastInsertRowid));
  } catch (e) {
    res.status(400).json({ error: 'Location name must be unique' });
  }
});

app.put('/api/locations/:id', (req, res) => {
  const { name, icon, color, sort_order } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  try {
    db.prepare('UPDATE locations SET name=?, icon=?, color=?, sort_order=? WHERE id=?').run(
      name.trim(), icon || '📦', color || '#6366f1', sort_order ?? 0, req.params.id
    );
    res.json(db.prepare('SELECT * FROM locations WHERE id = ?').get(req.params.id));
  } catch (e) {
    res.status(400).json({ error: 'Location name must be unique' });
  }
});

app.post('/api/locations/reorder', (req, res) => {
  const updates = req.body;
  const update = db.prepare('UPDATE locations SET sort_order=? WHERE id=?');
  const tx = db.transaction(() => { updates.forEach(u => update.run(u.sort_order, u.id)); });
  tx();
  res.json({ ok: true });
});

app.delete('/api/locations/:id', (req, res) => {
  const count = db.prepare('SELECT COUNT(*) as c FROM items WHERE location_id = ?').get(req.params.id).c;
  db.prepare('UPDATE items SET location_id = NULL WHERE location_id = ?').run(req.params.id);
  db.prepare('DELETE FROM locations WHERE id = ?').run(req.params.id);
  res.json({ ok: true, items_unassigned: count });
});

// ── Categories ─────────────────────────────────────────────────────────────
app.get('/api/categories', (req, res) => {
  res.json(db.prepare('SELECT * FROM categories ORDER BY name').all());
});

app.post('/api/categories', (req, res) => {
  const { name, icon, color } = req.body;
  try {
    const result = db.prepare('INSERT INTO categories (name, icon, color) VALUES (?, ?, ?)').run(name, icon || '📦', color || '#6366f1');
    res.json(db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid));
  } catch (e) {
    res.status(400).json({ error: 'Category name must be unique' });
  }
});

app.put('/api/categories/:id', (req, res) => {
  const { name, icon, color } = req.body;
  db.prepare('UPDATE categories SET name=?, icon=?, color=? WHERE id=?').run(name, icon, color, req.params.id);
  res.json(db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id));
});

app.delete('/api/categories/:id', (req, res) => {
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Tab Presets ────────────────────────────────────────────────────────────
app.get('/api/tab-presets', (req, res) => {
  const rows = db.prepare('SELECT * FROM tab_presets ORDER BY is_default DESC, name ASC').all();
  res.json(rows.map(r => ({ ...r, tabs: JSON.parse(r.tabs), is_default: !!r.is_default })));
});

app.post('/api/tab-presets', (req, res) => {
  const { name, tabs, is_default } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
  try {
    if (is_default) db.prepare('UPDATE tab_presets SET is_default = 0').run();
    const result = db.prepare('INSERT INTO tab_presets (name, tabs, is_default) VALUES (?, ?, ?)').run(
      name.trim(), JSON.stringify(tabs || []), is_default ? 1 : 0
    );
    const row = db.prepare('SELECT * FROM tab_presets WHERE id = ?').get(result.lastInsertRowid);
    res.json({ ...row, tabs: JSON.parse(row.tabs), is_default: !!row.is_default });
  } catch (e) {
    res.status(400).json({ error: 'Preset name must be unique' });
  }
});

app.put('/api/tab-presets/:id', (req, res) => {
  const { name, tabs, is_default } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
  try {
    if (is_default) db.prepare('UPDATE tab_presets SET is_default = 0').run();
    db.prepare('UPDATE tab_presets SET name=?, tabs=?, is_default=? WHERE id=?').run(
      name.trim(), JSON.stringify(tabs || []), is_default ? 1 : 0, req.params.id
    );
    const row = db.prepare('SELECT * FROM tab_presets WHERE id = ?').get(req.params.id);
    res.json({ ...row, tabs: JSON.parse(row.tabs), is_default: !!row.is_default });
  } catch (e) {
    res.status(400).json({ error: 'Preset name must be unique' });
  }
});

app.delete('/api/tab-presets/:id', (req, res) => {
  db.prepare('DELETE FROM tab_presets WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.post('/api/tab-presets/:id/set-default', (req, res) => {
  db.prepare('UPDATE tab_presets SET is_default = 0').run();
  db.prepare('UPDATE tab_presets SET is_default = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Items ──────────────────────────────────────────────────────────────────
const ITEM_SELECT = `
  SELECT i.*,
         c.name as category_name, c.icon as category_icon, c.color as category_color,
         l.name as location_name, l.icon as location_icon, l.color as location_color,
         COUNT(se.id) as sub_entry_count
  FROM items i
  LEFT JOIN categories c ON i.category_id = c.id
  LEFT JOIN locations l ON i.location_id = l.id
  LEFT JOIN sub_entries se ON se.item_id = i.id
`;

app.get('/api/items', (req, res) => {
  const { location_id, category_id, search } = req.query;
  let query = ITEM_SELECT + ' WHERE 1=1';
  const params = [];
  if (location_id === 'unassigned') {
    query += ' AND i.location_id IS NULL';
  } else if (location_id) {
    query += ' AND i.location_id = ?'; params.push(location_id);
  }
  if (category_id) { query += ' AND i.category_id = ?'; params.push(category_id); }
  if (search) {
    query += ` AND (i.name LIKE ? OR EXISTS (
      SELECT 1 FROM sub_entries se2
      WHERE se2.item_id = i.id AND se2.description LIKE ?
    ))`;
    params.push(`%${search}%`, `%${search}%`);
  }
  query += ' GROUP BY i.id ORDER BY i.name ASC';
  res.json(db.prepare(query).all(...params));
});

app.get('/api/items/similar', (req, res) => {
  const { name } = req.query;
  if (!name || name.length < 2) return res.json([]);
  const rows = db.prepare(ITEM_SELECT + `
    WHERE i.name LIKE ?
    GROUP BY i.id ORDER BY i.name ASC LIMIT 5
  `).all(`%${name}%`);
  res.json(rows);
});

app.get('/api/items/:id', (req, res) => {
  const item = db.prepare(ITEM_SELECT + ' WHERE i.id = ? GROUP BY i.id').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  item.sub_entries = db.prepare('SELECT * FROM sub_entries WHERE item_id = ? ORDER BY date_added DESC').all(req.params.id);
  res.json(item);
});

app.post('/api/items', (req, res) => {
  const { name, category_id, location_id, notes, quantity, quantity_num, date_added } = req.body;
  const result = db.prepare('INSERT INTO items (name, category_id, location_id, notes, quantity, quantity_num, date_added) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    name, category_id || null, location_id || null, notes || '', quantity || '', quantity_num != null ? parseFloat(quantity_num) : null, date_added || new Date().toISOString().split('T')[0]
  );
  const item = db.prepare(ITEM_SELECT + ' WHERE i.id = ? GROUP BY i.id').get(result.lastInsertRowid);
  item.sub_entries = [];
  res.json(item);
});

app.put('/api/items/:id', (req, res) => {
  const { name, category_id, location_id, notes, quantity, quantity_num, date_added } = req.body;
  db.prepare('UPDATE items SET name=?, category_id=?, location_id=?, notes=?, quantity=?, quantity_num=?, date_added=? WHERE id=?').run(
    name, category_id || null, location_id || null, notes || '', quantity || '', quantity_num != null ? parseFloat(quantity_num) : null, date_added, req.params.id
  );
  const item = db.prepare(ITEM_SELECT + ' WHERE i.id = ? GROUP BY i.id').get(req.params.id);
  item.sub_entries = db.prepare('SELECT * FROM sub_entries WHERE item_id = ? ORDER BY date_added DESC').all(req.params.id);
  res.json(item);
});

app.delete('/api/items/:id', (req, res) => {
  db.prepare('DELETE FROM items WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Sub-entries ────────────────────────────────────────────────────────────
app.get('/api/items/:id/sub-entries', (req, res) => {
  res.json(db.prepare('SELECT * FROM sub_entries WHERE item_id = ? ORDER BY date_added DESC').all(req.params.id));
});

app.post('/api/items/:id/sub-entries', (req, res) => {
  const { description, quantity, quantity_num, date_added } = req.body;
  const result = db.prepare('INSERT INTO sub_entries (item_id, description, quantity, quantity_num, date_added) VALUES (?, ?, ?, ?, ?)').run(
    req.params.id, description, quantity || '', quantity_num != null ? parseFloat(quantity_num) : null, date_added || new Date().toISOString().split('T')[0]
  );
  res.json(db.prepare('SELECT * FROM sub_entries WHERE id = ?').get(result.lastInsertRowid));
});

app.put('/api/sub-entries/:id', (req, res) => {
  const { description, quantity, quantity_num, date_added } = req.body;
  db.prepare('UPDATE sub_entries SET description=?, quantity=?, quantity_num=?, date_added=? WHERE id=?').run(description, quantity || '', quantity_num != null ? parseFloat(quantity_num) : null, date_added, req.params.id);
  res.json(db.prepare('SELECT * FROM sub_entries WHERE id = ?').get(req.params.id));
});

app.delete('/api/sub-entries/:id', (req, res) => {
  db.prepare('DELETE FROM sub_entries WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Stats ──────────────────────────────────────────────────────────────────
app.get('/api/stats', (req, res) => {
  res.json({
    total_items: db.prepare('SELECT COUNT(*) as c FROM items').get().c,
    total_sub_entries: db.prepare('SELECT COUNT(*) as c FROM sub_entries').get().c,
    by_location: db.prepare(`
      SELECT l.id, l.name, l.icon, l.color, COUNT(i.id) as count
      FROM locations l LEFT JOIN items i ON i.location_id = l.id
      GROUP BY l.id ORDER BY l.sort_order ASC
    `).all(),
    by_category: db.prepare(`
      SELECT c.id, c.name, c.icon, c.color, COUNT(i.id) as count
      FROM categories c LEFT JOIN items i ON i.category_id = c.id
      GROUP BY c.id ORDER BY c.name ASC
    `).all(),
    unassigned_count: db.prepare('SELECT COUNT(*) as c FROM items WHERE location_id IS NULL').get().c,
  });
});

// ── Backup & Restore ───────────────────────────────────────────────────────
app.get('/api/backup', (req, res) => {
  try {
    const backup = {
      version: 2,
      exported_at: new Date().toISOString(),
      locations: db.prepare('SELECT * FROM locations ORDER BY sort_order').all(),
      categories: db.prepare('SELECT * FROM categories ORDER BY name').all(),
      items: db.prepare('SELECT * FROM items ORDER BY id').all(),
      sub_entries: db.prepare('SELECT * FROM sub_entries ORDER BY id').all(),
      tab_presets: db.prepare('SELECT * FROM tab_presets ORDER BY id').all(),
    };
    const filename = `homelarder-backup-${new Date().toISOString().slice(0,10)}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    res.json(backup);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/restore', (req, res) => {
  const backup = req.body;
  if (!backup || backup.version !== 2) {
    return res.status(400).json({ error: 'Invalid or incompatible backup file (expected version 2)' });
  }
  try {
    db.transaction(() => {
      db.prepare('DELETE FROM sub_entries').run();
      db.prepare('DELETE FROM items').run();
      db.prepare('DELETE FROM tab_presets').run();
      db.prepare('DELETE FROM categories').run();
      db.prepare('DELETE FROM locations').run();
      for (const t of ['sub_entries','items','tab_presets','categories','locations']) {
        try { db.prepare('DELETE FROM sqlite_sequence WHERE name = ?').run(t); } catch {}
      }
      const insLoc = db.prepare('INSERT INTO locations (id,name,icon,color,sort_order,created_at) VALUES (?,?,?,?,?,?)');
      for (const l of (backup.locations || [])) insLoc.run(l.id,l.name,l.icon,l.color,l.sort_order,l.created_at);
      const insCat = db.prepare('INSERT INTO categories (id,name,icon,color,created_at) VALUES (?,?,?,?,?)');
      for (const c of (backup.categories || [])) insCat.run(c.id,c.name,c.icon,c.color,c.created_at);
      const insItem = db.prepare('INSERT INTO items (id,name,category_id,location_id,notes,quantity,quantity_num,date_added,created_at) VALUES (?,?,?,?,?,?,?,?,?)');
      for (const i of (backup.items || [])) insItem.run(i.id,i.name,i.category_id,i.location_id,i.notes,i.quantity||'',i.quantity_num??null,i.date_added,i.created_at);
      const insSub = db.prepare('INSERT INTO sub_entries (id,item_id,description,quantity,quantity_num,date_added,created_at) VALUES (?,?,?,?,?,?,?)');
      for (const s of (backup.sub_entries || [])) insSub.run(s.id,s.item_id,s.description,s.quantity,s.quantity_num??null,s.date_added,s.created_at);
      const insPreset = db.prepare('INSERT INTO tab_presets (id,name,tabs,is_default,created_at) VALUES (?,?,?,?,?)');
      for (const p of (backup.tab_presets || [])) insPreset.run(p.id,p.name,p.tabs,p.is_default,p.created_at);
    })();
    res.json({
      ok: true,
      counts: {
        locations: backup.locations?.length || 0,
        categories: backup.categories?.length || 0,
        items: backup.items?.length || 0,
        sub_entries: backup.sub_entries?.length || 0,
        tab_presets: backup.tab_presets?.length || 0,
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`HomeLarder API running on port ${PORT}`));
