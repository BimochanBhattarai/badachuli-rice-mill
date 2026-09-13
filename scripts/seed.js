#!/usr/bin/env node
/**
 * Seed script — wipes dev.db and seeds clean test data.
 * Run: npx electron scripts/seed.js
 */

const { app }  = require('electron')
const Database = require('better-sqlite3')
const argon2   = require('argon2')
const fs       = require('fs')
const path     = require('path')

const DB_PATH        = path.join(__dirname, '..', 'dev.db')
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations')

app.whenReady().then(async () => {
  try {
    // ── Delete existing DB + WAL sidecars ───────────────────────────────────
    for (const suffix of ['', '-shm', '-wal']) {
      const p = DB_PATH + suffix
      if (fs.existsSync(p)) fs.unlinkSync(p)
    }
    console.log('✓ Deleted existing dev.db')

    // ── Open fresh DB ───────────────────────────────────────────────────────
    const db = new Database(DB_PATH)
    db.pragma('foreign_keys = ON')
    console.log('✓ Created fresh dev.db')

    // ── Run migrations ──────────────────────────────────────────────────────
    const migFiles = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort()

    for (const file of migFiles) {
      const version = parseInt(file.split('_')[0], 10)
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8')
      db.exec(sql)
      db.pragma(`user_version = ${version}`)
      console.log(`✓ Migration ${file}`)
    }

    // ── 1. Admin user (PIN: 1234) ───────────────────────────────────────────
    const pinHash = await argon2.hash('1234', {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    })
    db.prepare(`INSERT INTO users (username, pin_hash, role) VALUES (?, ?, 'owner')`)
      .run('admin', pinHash)
    console.log('✓ User: admin / PIN: 1234')

    // ── 2. Units — wipe migration defaults, keep only 3 Nepali units ─────────
    // Migration 0001 seeds English units; delete all and re-seed in Nepali.
    db.exec('DELETE FROM units')
    const unitKg  = db.prepare(`INSERT INTO units (name, abbreviation, base_factor, is_default) VALUES (?, 'kg',  1, 1)`).run('किलोग्राम').lastInsertRowid
    const unitPcs = db.prepare(`INSERT INTO units (name, abbreviation, base_factor, is_default) VALUES (?, 'pcs', 1, 0)`).run('थान').lastInsertRowid
    const unitLtr = db.prepare(`INSERT INTO units (name, abbreviation, base_factor, is_default) VALUES (?, 'ltr', 1, 0)`).run('लिटर').lastInsertRowid

    db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('default_unit_id', ?)`).run(JSON.stringify(unitKg))
    console.log('✓ Units: किलोग्राम (kg), थान (pcs), लिटर (ltr)')

    // ── 3. Businesses ─────────────────────────────────────────────────────────
    db.prepare(`UPDATE businesses SET name='बडाचुली राइस मिल', pan_number='609123456', phone='056-523456', address='कावासोती-१, नवलपरासी', bill_prefix='BRM', bill_next_sequence=1 WHERE id=1`).run()
    db.prepare(`UPDATE businesses SET name='बडाचुली एग्रो', pan_number='609789012', phone='056-523457', address='कावासोती-१, नवलपरासी', bill_prefix='BAG', bill_next_sequence=1 WHERE id=2`).run()
    console.log('✓ Businesses: बडाचुली राइस मिल (BRM), बडाचुली एग्रो (BAG)')

    // ── 4. Items ──────────────────────────────────────────────────────────────
    function addItem(name, category, unitId, buyable, sellable, processable) {
      return db.prepare(`INSERT INTO items (name, category, default_unit_id, is_buyable, is_sellable, is_processable) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(name, category, unitId, buyable ? 1 : 0, sellable ? 1 : 0, processable ? 1 : 0).lastInsertRowid
    }

    // Raw materials — mill buys and/or customers bring for processing
    const iMakai    = addItem('मकै',            'raw_material', unitKg,  true, false, true)
    const iGahu     = addItem('गहुँ',           'raw_material', unitKg,  true, false, true)
    const iDhan     = addItem('धान',            'raw_material', unitKg,  true, false, true)
    const iTori     = addItem('तोरी',           'raw_material', unitKg,  true, false, true)
    const iKodo     = addItem('कोदो',           'raw_material', unitKg,  true, false, true)
    const iDal      = addItem('दाल',            'raw_material', unitKg,  true, false, true)
    const iBesar    = addItem('बेसार',          'raw_material', unitKg,  true, false, true)
    const iKhur     = addItem('खुर्सानी',       'raw_material', unitKg,  true, false, true)
    const iBhijeko  = addItem('भिजाएको चामल', 'raw_material', unitKg,  true, false, true)

    // Finished products
    const iAato     = addItem('आटो',            'finished',     unitKg,  false, true, false)
    const iMaida    = addItem('मैदा',           'finished',     unitKg,  false, true, false)
    const iDana     = addItem('दाना',           'finished',     unitKg,  false, true, false)
    const iPitho    = addItem('पिठो',           'finished',     unitKg,  false, true, false)
    const iChamal   = addItem('लोकल चामल',     'finished',     unitKg,  false, true, false)
    const iTel      = addItem('तेल',            'finished',     unitLtr, false, true, false)

    // Byproducts
    const iDhuto    = addItem('ढुटो',           'byproduct',    unitKg,  false, true, false)
    const iDadalnu  = addItem('डडाल्नो',        'byproduct',    unitKg,  false, true, false)
    const iKanika   = addItem('कनिका',          'byproduct',    unitKg,  false, true, false)
    const iPina     = addItem('पिना',           'byproduct',    unitKg,  false, true, false)

    console.log('✓ Items: 19 items (9 raw, 6 finished, 4 byproduct)')

    // ── 5. Variants ────────────────────────────────────────────────────────
    function addVariant(itemId, name, isDefault) {
      return db.prepare(`INSERT INTO variants (item_id, name, is_default) VALUES (?, ?, ?)`)
        .run(itemId, name, isDefault ? 1 : 0).lastInsertRowid
    }

    // लोकल चामल has 3 named variants
    const vSanwa   = addVariant(iChamal, 'साँवा',    true)
    const vSavitri = addVariant(iChamal, 'साबित्री', false)
    const vSona    = addVariant(iChamal, 'सोना',     false)

    // All other items get one default variant (same name as item)
    const singleItems = [
      [iMakai, 'मकै'], [iGahu, 'गहुँ'], [iDhan, 'धान'], [iTori, 'तोरी'],
      [iKodo, 'कोदो'], [iDal, 'दाल'], [iBesar, 'बेसार'], [iKhur, 'खुर्सानी'],
      [iBhijeko, 'भिजाएको चामल'], [iAato, 'आटो'], [iMaida, 'मैदा'],
      [iDana, 'दाना'], [iPitho, 'पिठो'], [iTel, 'तेल'],
      [iDhuto, 'ढुटो'], [iDadalnu, 'डडाल्नो'], [iKanika, 'कनिका'], [iPina, 'पिना'],
    ]
    for (const [id, name] of singleItems) addVariant(id, name, true)
    console.log('✓ Variants: लोकल चामल ×3 (साँवा/साबित्री/सोना) + defaults')

    // ── 6. Prices ─────────────────────────────────────────────────────────
    function addPrice(itemId, variantId, unitId, price, type) {
      db.prepare(`INSERT INTO prices (item_id, variant_id, unit_id, price, price_type) VALUES (?, ?, ?, ?, ?)`)
        .run(itemId, variantId, unitId, price, type)
    }
    function defV(itemId) {
      return db.prepare('SELECT id FROM variants WHERE item_id=? AND is_default=1').get(itemId)?.id ?? null
    }

    // Sell prices
    addPrice(iAato,    defV(iAato),    unitKg,  45,  'sell')
    addPrice(iMaida,   defV(iMaida),   unitKg,  47,  'sell')
    addPrice(iDana,    defV(iDana),    unitKg,  43,  'sell')
    addPrice(iPitho,   defV(iPitho),   unitKg,  35,  'sell')
    addPrice(iChamal,  vSanwa,         unitKg,  88,  'sell')
    addPrice(iChamal,  vSavitri,       unitKg,  75,  'sell')
    addPrice(iChamal,  vSona,          unitKg,  72,  'sell')
    addPrice(iTel,     defV(iTel),     unitLtr, 400, 'sell')
    addPrice(iDhuto,   defV(iDhuto),   unitKg,  45,  'sell')
    addPrice(iDadalnu, defV(iDadalnu), unitKg,  10,  'sell')
    addPrice(iKanika,  defV(iKanika),  unitKg,  6,   'sell')
    addPrice(iPina,    defV(iPina),    unitKg,  40,  'sell')

    // Processing prices (per kg fee charged to customers for service)
    addPrice(iMakai,   defV(iMakai),   unitKg, 4,   'processing')  // मकै आटो
    addPrice(iGahu,    defV(iGahu),    unitKg, 6,   'processing')  // गहुँ
    addPrice(iDhan,    defV(iDhan),    unitKg, 2,   'processing')  // धान
    addPrice(iTori,    defV(iTori),    unitKg, 19,  'processing')  // तोरी (पिना लैजाने)
    addPrice(iKodo,    defV(iKodo),    unitKg, 6,   'processing')  // कोदो
    addPrice(iDal,     defV(iDal),     unitKg, 7,   'processing')  // दाल
    addPrice(iBesar,   defV(iBesar),   unitKg, 30,  'processing')  // बेसार
    addPrice(iKhur,    defV(iKhur),    unitKg, 50,  'processing')  // खुर्सानी
    addPrice(iBhijeko, defV(iBhijeko), unitKg, 12,  'processing')  // भिजाएको चामल
    addPrice(iPina,    defV(iPina),    unitKg, 45,  'processing')  // पिना पिसाउनु

    // Buy prices (mill pays these when purchasing raw stock)
    addPrice(iMakai, defV(iMakai), unitKg, 38,  'buy')
    addPrice(iGahu,  defV(iGahu),  unitKg, 28,  'buy')
    addPrice(iDhan,  defV(iDhan),  unitKg, 35,  'buy')
    addPrice(iTori,  defV(iTori),  unitKg, 120, 'buy')
    addPrice(iKodo,  defV(iKodo),  unitKg, 25,  'buy')

    console.log('✓ Prices: sell + processing + buy rates')

    // ── 7. Customers ──────────────────────────────────────────────────────
    const customers = [
      ['रामकुमार श्रेष्ठ',    '9856001234', 'कावासोती-२'],
      ['सुनिता गुरुङ',        '9812005678', 'कावासोती-४'],
      ['बिर बहादुर थापा',    '9841009876', 'कावासोती-६'],
      ['पार्वती देवी पाण्डे',  '9867001122', 'कावासोती-१'],
      ['कृष्ण प्रसाद पोखरेल', '9824003344', 'कावासोती-३'],
      ['मनमाया तामाङ',       '9851007788', 'कावासोती-७'],
      ['हरि प्रसाद कुँवर',   '9866009900', 'कावासोती-५'],
    ]
    for (const [name, phone, address] of customers) {
      db.prepare(`INSERT INTO customers (name, phone, address) VALUES (?, ?, ?)`).run(name, phone, address)
    }
    console.log(`✓ Customers: ${customers.length} sample customers`)

    // ── 8. Settings ───────────────────────────────────────────────────────
    db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('vat_pct', '0')`).run()
    db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('ui_language', '"ne"')`).run()

    db.close()

    console.log('\n╔══════════════════════════════════════════════════════╗')
    console.log('║  ✅  Database seeded successfully!                   ║')
    console.log('╠══════════════════════════════════════════════════════╣')
    console.log('║  Login:       admin / 1234                           ║')
    console.log('║  Business 1:  बडाचुली राइस मिल  (BRM-xxxx)         ║')
    console.log('║  Business 2:  बडाचुली एग्रो       (BAG-xxxx)        ║')
    console.log('║  Items:       19 items in Nepali                     ║')
    console.log('║  Customers:   7 sample customers                     ║')
    console.log('╚══════════════════════════════════════════════════════╝\n')

  } catch (err) {
    console.error('Seed failed:', err)
    process.exit(1)
  } finally {
    app.quit()
  }
})
