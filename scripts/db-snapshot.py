#!/usr/bin/env python3
"""
Database snapshot manager for Badachuli Rice Mill.

Commands:
  list                    Show all available snapshots
  create [label]          Save current production db as a new snapshot
  restore <snapshot>      Restore a snapshot to the production db location
  info <snapshot>         Show details about a snapshot

Examples:
  python3 scripts/db-snapshot.py list
  python3 scripts/db-snapshot.py create "after_first_month"
  python3 scripts/db-snapshot.py restore v1_2026-09-17_initial
  python3 scripts/db-snapshot.py info v1_2026-09-17_initial
"""

import os
import platform
import shutil
import sqlite3
import sys
from datetime import date
from pathlib import Path

# ── Path resolution ───────────────────────────────────────────────────────────

def project_root() -> Path:
    return Path(__file__).parent.parent.resolve()

def snapshots_dir() -> Path:
    return project_root() / "snapshots"

def production_db_path() -> Path:
    """Return the path to the live production database for this platform."""
    system = platform.system()
    if system == "Windows":
        appdata = os.environ.get("APPDATA", "")
        if not appdata:
            raise RuntimeError("APPDATA environment variable not set")
        return Path(appdata) / "Badachuli Rice Mill" / "badachuli.db"
    elif system == "Darwin":
        # Use dev.db when running from the project directory (developer mode)
        dev_db = project_root() / "dev.db"
        if dev_db.exists():
            return dev_db
        # Packaged app location
        return Path.home() / "Library" / "Application Support" / "Badachuli Rice Mill" / "badachuli.db"
    else:
        # Linux / other
        return Path.home() / ".config" / "Badachuli Rice Mill" / "badachuli.db"

def snapshot_path(name: str) -> Path:
    """Resolve a snapshot name or path to a full path."""
    p = Path(name)
    if p.exists():
        return p
    # Try as a name within snapshots dir (with or without .db)
    candidate = snapshots_dir() / (name if name.endswith(".db") else name + ".db")
    if candidate.exists():
        return candidate
    raise FileNotFoundError(f"Snapshot not found: {name}")

# ── SQLite helpers ────────────────────────────────────────────────────────────

def db_stats(path: Path) -> dict:
    try:
        conn = sqlite3.connect(str(path))
        version   = conn.execute("PRAGMA user_version").fetchone()[0]
        customers = conn.execute("SELECT COUNT(*) FROM customers").fetchone()[0]
        items     = conn.execute("SELECT COUNT(*) FROM items").fetchone()[0]
        users     = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        biz_rows  = conn.execute("SELECT name FROM businesses").fetchall()
        businesses = [r[0] for r in biz_rows]
        # Single source of truth as of migration 0017: the running customer balance.
        # Pre-0017 databases have no `balance` column, so fall back to the legacy formula.
        if version >= 17:
            outstanding = conn.execute(
                "SELECT COALESCE(SUM(balance),0) FROM customers WHERE balance > 0.005"
            ).fetchone()[0]
        else:
            outstanding = conn.execute(
                "SELECT COALESCE(SUM(due_amount),0) + (SELECT COALESCE(SUM(opening_balance),0) FROM customers WHERE opening_balance > 0) FROM bills WHERE status='active'"
            ).fetchone()[0]
        conn.close()
        return {
            "version": version,
            "customers": customers,
            "items": items,
            "users": users,
            "businesses": businesses,
            "outstanding": outstanding,
        }
    except Exception as e:
        return {"error": str(e)}

def create_snapshot(db_path: Path, snapshot_file: Path) -> None:
    """Use VACUUM INTO for a clean, WAL-free, compacted copy."""
    conn = sqlite3.connect(str(db_path))
    conn.execute(f"VACUUM INTO '{snapshot_file}'")
    conn.close()

# ── Restore helper file generators ───────────────────────────────────────────

def write_restore_bat(snapshot_file: Path) -> Path:
    """Write a Windows .bat file that restores this snapshot."""
    bat_path = snapshot_file.with_suffix(".restore-windows.bat")
    db_name = snapshot_file.name
    content = f"""@echo off
:: Restores {db_name} to the Badachuli Rice Mill database on Windows.
:: Close the app before running this, then restart it afterward.

set TARGET=%APPDATA%\\Badachuli Rice Mill\\badachuli.db
set SNAPSHOT=%~dp0{db_name}

if not exist "%APPDATA%\\Badachuli Rice Mill" (
    mkdir "%APPDATA%\\Badachuli Rice Mill"
)

echo Restoring database from {db_name} ...
copy /Y "%SNAPSHOT%" "%TARGET%"
if %errorlevel% == 0 (
    echo Done! Restart the Badachuli Rice Mill app.
) else (
    echo ERROR: Could not copy file. Make sure the app is closed.
)
pause
"""
    bat_path.write_text(content, encoding="utf-8")
    return bat_path

def write_restore_sh(snapshot_file: Path) -> Path:
    """Write a Mac/Linux .sh file that restores this snapshot."""
    sh_path = snapshot_file.with_suffix(".restore-mac.sh")
    db_name = snapshot_file.name
    content = (
        "#!/bin/bash\n"
        f"# Restores {db_name} to the Badachuli Rice Mill database on macOS.\n"
        "# Close the app before running this, then restart it afterward.\n"
        "\n"
        'SCRIPT_DIR=$(dirname "$0")\n'
        f'SNAPSHOT="$SCRIPT_DIR/{db_name}"\n'
        'TARGET="$HOME/Library/Application Support/Badachuli Rice Mill/badachuli.db"\n'
        'TARGET_DIR="$HOME/Library/Application Support/Badachuli Rice Mill"\n'
        "\n"
        'mkdir -p "$TARGET_DIR"\n'
        f'echo "Restoring database from {db_name} ..."\n'
        'cp "$SNAPSHOT" "$TARGET"\n'
        'echo "Done! Restart the Badachuli Rice Mill app."\n'
    )
    sh_path.write_text(content, encoding="utf-8")
    sh_path.chmod(0o755)
    return sh_path

# ── Commands ─────────────────────────────────────────────────────────────────

def cmd_list() -> None:
    sd = snapshots_dir()
    files = sorted(sd.glob("*.db"))
    if not files:
        print("No snapshots found in", sd)
        return
    print(f"\n{'Snapshot':<45} {'Size':>7}  {'Customers':>9}  {'Items':>5}  {'Schema':>6}")
    print("─" * 80)
    for f in files:
        size_kb = f.stat().st_size // 1024
        stats = db_stats(f)
        if "error" in stats:
            print(f"{f.name:<45}  {'?':>7}  {'(error)':>9}")
        else:
            print(
                f"{f.name:<45} {size_kb:>6}K"
                f"  {stats['customers']:>9}"
                f"  {stats['items']:>5}"
                f"  v{stats['version']:>5}"
            )
    print()

def cmd_info(name: str) -> None:
    path = snapshot_path(name)
    stats = db_stats(path)
    size_kb = path.stat().st_size // 1024
    print(f"\nSnapshot : {path.name}")
    print(f"File     : {path}")
    print(f"Size     : {size_kb} KB")
    if "error" in stats:
        print(f"Error    : {stats['error']}")
        return
    print(f"Schema   : v{stats['version']}")
    print(f"Customers: {stats['customers']}")
    print(f"Items    : {stats['items']}")
    print(f"Users    : {stats['users']}")
    print(f"Businesses: {', '.join(stats['businesses']) or '(none)'}")
    print(f"Total outstanding: Rs. {stats['outstanding']:,.2f}")
    bat = path.with_suffix(".restore-windows.bat")
    sh  = path.with_suffix(".restore-mac.sh")
    print(f"\nRestore files:")
    print(f"  Windows : {bat.name} {'✓' if bat.exists() else '(missing)'}")
    print(f"  Mac     : {sh.name} {'✓' if sh.exists() else '(missing)'}")
    print()

def cmd_create(label: str | None) -> None:
    src = production_db_path()
    if not src.exists():
        print(f"ERROR: Production db not found at {src}", file=sys.stderr)
        sys.exit(1)

    today = date.today().strftime("%Y-%m-%d")
    slug  = label.strip().replace(" ", "_") if label else "snapshot"
    name  = f"{today}_{slug}.db"
    dest  = snapshots_dir() / name

    if dest.exists():
        print(f"ERROR: Snapshot already exists: {dest}", file=sys.stderr)
        sys.exit(1)

    snapshots_dir().mkdir(exist_ok=True)
    print(f"Creating snapshot from {src} ...")
    create_snapshot(src, dest)

    bat = write_restore_bat(dest)
    sh  = write_restore_sh(dest)

    stats = db_stats(dest)
    size_kb = dest.stat().st_size // 1024
    print(f"  Saved  : {dest.name}  ({size_kb} KB)")
    print(f"  Stats  : {stats.get('customers','?')} customers, {stats.get('items','?')} items, v{stats.get('version','?')}")
    print(f"  Windows restore : {bat.name}")
    print(f"  Mac restore     : {sh.name}")
    print()

def cmd_restore(name: str) -> None:
    src = snapshot_path(name)
    dst = production_db_path()

    stats = db_stats(src)
    print(f"\nRestoring: {src.name}")
    print(f"       To: {dst}")
    print(f"   Schema: v{stats.get('version','?')}")
    print(f"Customers: {stats.get('customers','?')}")
    print()

    confirm = input("Type 'yes' to confirm restore (current db will be overwritten): ").strip().lower()
    if confirm != "yes":
        print("Cancelled.")
        return

    dst.parent.mkdir(parents=True, exist_ok=True)

    # Remove any stale WAL files at destination
    for ext in ["-wal", "-shm"]:
        stale = dst.parent / (dst.name + ext)
        if stale.exists():
            stale.unlink()

    shutil.copy2(str(src), str(dst))
    print(f"Restored successfully. Restart the app.")
    print()

# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    args = sys.argv[1:]
    if not args or args[0] in ("-h", "--help"):
        print(__doc__)
        return

    cmd = args[0]
    if cmd == "list":
        cmd_list()
    elif cmd == "info":
        if len(args) < 2:
            print("Usage: db-snapshot.py info <snapshot>")
            sys.exit(1)
        cmd_info(args[1])
    elif cmd == "create":
        cmd_create(args[1] if len(args) > 1 else None)
    elif cmd == "restore":
        if len(args) < 2:
            print("Usage: db-snapshot.py restore <snapshot>")
            sys.exit(1)
        cmd_restore(args[1])
    else:
        print(f"Unknown command: {cmd}")
        print(__doc__)
        sys.exit(1)

if __name__ == "__main__":
    main()
