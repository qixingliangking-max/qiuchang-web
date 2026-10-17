#!/usr/bin/env python3
"""Cache football team crests as immutable same-origin assets at fixture intake.

PUBLIC data only. Never reads model/AI private data, never writes Supabase.
Existing crest files are immutable and never re-downloaded.
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
import re
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets" / "team-logos"
CATALOG = ROOT / "data" / "team-logos" / "catalog.json"
CATALOG_JS = ASSETS / "catalog.js"
ARCHIVE_MANIFEST = ROOT / "data" / "overview" / "manifest.json"
BEIJING = timezone(timedelta(hours=8))
MAX_LOGO_BYTES = 900_000


def public_api_config():
    src = (ROOT / "supabase-config.js").read_text(encoding="utf-8")
    url = re.search(r'QC_SUPABASE_URL\s*=\s*["\x27]([^"\x27]+)', src)
    key = re.search(r'QC_SUPABASE_PUBLISHABLE_KEY\s*=\s*["\x27]([^"\x27]+)', src)
    if not url or not key:
        raise RuntimeError("Missing publishable Supabase config")
    return url.group(1).rstrip("/"), key.group(1)


def public_request(endpoint, params=None, body=None):
    base, key = public_api_config()
    url = base + endpoint
    if params:
        url += "?" + urllib.parse.urlencode(params)
    headers = {"apikey": key, "Authorization": "Bearer " + key,
               "Accept": "application/json"}
    encoded = None
    if body is not None:
        encoded = json.dumps(body, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=encoded, headers=headers,
                                 method="POST" if encoded is not None else "GET")
    with urllib.request.urlopen(req, timeout=35) as res:
        return json.load(res)


def safe_source(url):
    """Only exact, known image CDN paths, never arbitrary URLs or hosts."""
    src = str(url or "").strip()
    p = urllib.parse.urlsplit(src)
    if p.scheme != "https" or p.username or p.password or p.port or p.query or p.fragment:
        return None
    if p.hostname == "images.fotmob.com":
        match = re.fullmatch(r"/image_resources/logo/teamlogo/([0-9]{1,10})\.png", p.path)
        return ("fotmob-" + match.group(1)) if match else None
    if p.hostname == "a.espncdn.com":
        match = re.fullmatch(r"/i/teamlogos/soccer/500/([0-9]{1,10})\.png", p.path)
        if match:
            return "espn-soccer-" + match.group(1)
        match = re.fullmatch(r"/i/teamlogos/countries/500/([a-z0-9_-]{2,16})\.png", p.path)
        if match:
            return "espn-country-" + match.group(1)
    return None


class NoExternalRedirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError("Unexpected CDN image redirect")


IMAGE_OPENER = urllib.request.build_opener(NoExternalRedirects)


def asset_is_valid(path):
    if not path.is_file() or path.stat().st_size > MAX_LOGO_BYTES:
        return False
    header = path.read_bytes()[:12]
    return (header.startswith(b"\x89PNG\r\n\x1a\n") or
            header.startswith(b"\xff\xd8\xff") or
            (header.startswith(b"RIFF") and header[8:12] == b"WEBP"))


def download_immutable_logo(url):
    asset_stem = safe_source(url)
    if not asset_stem:
        return None
    for ext in (".png", ".jpg", ".webp"):
        candidate = ASSETS / (asset_stem + ext)
        if asset_is_valid(candidate):
            return "assets/team-logos/" + candidate.name
    try:
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0 (compatible; QCDA-StaticCrestArchiver/1.0)",
            "Accept": "image/png,image/webp,image/jpeg"})
        with IMAGE_OPENER.open(req, timeout=16) as response:
            data = response.read(MAX_LOGO_BYTES + 1)
        if not data or len(data) > MAX_LOGO_BYTES:
            raise ValueError("Image exceeds size limit or is empty")
        if data.startswith(b"\x89PNG\r\n\x1a\n"):
            extension = ".png"
        elif data.startswith(b"\xff\xd8\xff"):
            extension = ".jpg"
        elif data.startswith(b"RIFF") and data[8:12] == b"WEBP":
            extension = ".webp"
        else:
            raise ValueError("Response is not PNG/JPEG/WebP")
        destination = ASSETS / (asset_stem + extension)
        if not destination.exists():
            temporary = destination.with_suffix(destination.suffix + ".tmp")
            temporary.write_bytes(data)
            os.replace(temporary, destination)
        return "assets/team-logos/" + destination.name
    except Exception as exc:
        print("WARNING crest cache:", asset_stem, str(exc)[:160])
        return None


def collect_team_names():
    """Use archive logos plus scheduled fixtures, never sensitive predictions."""
    names = {}
    if ARCHIVE_MANIFEST.exists():
        manifest = json.loads(ARCHIVE_MANIFEST.read_text(encoding="utf-8"))
        for relative in (manifest.get("dates") or {}).values():
            path = (ROOT / relative).resolve()
            if not path.is_relative_to(ROOT) or not path.is_file():
                continue
            payload = json.loads(path.read_text(encoding="utf-8"))
            for row in payload.get("rows", []):
                for side in ("home", "away"):
                    name = str(row.get(side + "_team_name") or "").strip()
                    url = str(row.get("_" + side + "LogoUrl") or "").strip()
                    if name and name not in names:
                        names[name] = url

    today = datetime.now(BEIJING).date()
    # Pre-cache future fixtures immediately after their first schedule snapshot.
    records = public_request("/rest/v1/jc_overview_schedule_snapshots", {
        "select": "business_date,payload",
        "business_date": "gte." + (today - timedelta(days=1)).isoformat(),
        "order": "business_date.asc",
        "limit": "15"
    })
    for entry in records:
        for row in (entry.get("payload") or {}).get("rows", []):
            for side in ("home", "away"):
                name = str(row.get(side + "_team_name") or "").strip()
                url = str(row.get("_" + side + "LogoUrl") or "").strip()
                if name and name not in names:
                    names[name] = url
    return names


def fill_missing_sources(teams):
    unknown = [name for name, url in teams.items() if not safe_source(url)]
    for pos in range(0, len(unknown), 90):
        batch = unknown[pos:pos + 90]
        rows = public_request("/rest/v1/rpc/resolve_team_logos",
                              body={"p_names": batch})
        for row in rows or []:
            name = str(row.get("input_name") or "")
            source = str(row.get("logo_url") or "")
            if name in teams and safe_source(source):
                teams[name] = source


def publish():
    ASSETS.mkdir(parents=True, exist_ok=True)
    CATALOG.parent.mkdir(parents=True, exist_ok=True)
    old = json.loads(CATALOG.read_text(encoding="utf-8")) if CATALOG.exists() else {}
    by_source = dict(old.get("by_source") or {})
    by_team = dict(old.get("by_team") or {})
    teams = collect_team_names()
    fill_missing_sources(teams)
    source_urls = sorted({url for url in teams.values() if safe_source(url)})

    needed = [url for url in source_urls if
              not asset_is_valid(ROOT / by_source.get(url, "nonexistent"))]
    print("Fixture/archived teams:", len(teams),
          "remote unique logos:", len(source_urls),
          "logos to archive:", len(needed))

    with ThreadPoolExecutor(max_workers=8) as pool:
        jobs = {pool.submit(download_immutable_logo, url): url for url in needed}
        for future in as_completed(jobs):
            local = future.result()
            if local:
                by_source[jobs[future]] = local

    for name, source in teams.items():
        existing = by_team.get(name)
        if existing and asset_is_valid(ROOT / existing):
            continue  # First confirmed team crest is permanent.
        local = by_source.get(source)
        if local and asset_is_valid(ROOT / local):
            by_team[name] = local

    data = {"version": 1, "by_source": dict(sorted(by_source.items())),
            "by_team": dict(sorted(by_team.items()))}
    compact = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    new_json = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    new_js = "window.QC_TEAM_LOGO_CATALOG=" + compact + ";\n"
    if not CATALOG.exists() or CATALOG.read_text(encoding="utf-8") != new_json:
        CATALOG.write_text(new_json, encoding="utf-8")
    if not CATALOG_JS.exists() or CATALOG_JS.read_text(encoding="utf-8") != new_js:
        CATALOG_JS.write_text(new_js, encoding="utf-8")
    print("LOCAL static team crests mapped:", len(by_team),
          "sources:", len(by_source), "unresolved:", len(teams) - len([
              name for name in teams if name in by_team]))


if __name__ == "__main__":
    publish()
