#!/usr/bin/env python3
"""
wp_dedupe_elt365.py - Finish the ELT365 deduplication on sourovdeb.com.

What it does:
  1. Fetches every published post (paged, read-only).
  2. Finds ELT365 posts whose title carries "Day 152" through "Day 212".
  3. For each of those 61 day-numbers, picks ONE canonical post:
       a) has category "English Lessons" (term id 1309)
       b) most tags
       c) lowest post id (earliest published)
  4. Moves every other post of that day-number to WordPress TRASH
     (REST DELETE with force=false - recoverable for 30 days).

The script is IDEMPOTENT: rerun it as many times as you like. It recomputes
the current duplicate set from live site data each run, so it finishes
whatever remains without touching anything twice.

Setup (one time):
  WP Admin -> Users -> Your Profile -> Application Passwords -> Add New.
  Export as environment variables, or answer the prompts:

    export WP_URL="https://sourovdeb.com"
    export WP_USER="YOUR_WP_USERNAME"
    export WP_APP_PASSWORD="xxxx xxxx xxxx xxxx xxxx xxxx"

Usage:
  python3 wp_dedupe_elt365.py            # dry run: shows the plan, deletes nothing
  python3 wp_dedupe_elt365.py --apply   # actually moves duplicates to trash

Restore (if needed):
  WP Admin -> Posts -> Trash -> Restore. Trashed posts survive 30 days.
  Canonical keeper IDs for every day are printed by the dry run, and stored
  in elt365-dedup-manifest.md.
"""

import json
import os
import sys
import time
import base64
import re
import urllib.request
import urllib.error

CANON_CAT = 1309      # "English Lessons" category id
DAY_MIN, DAY_MAX = 152, 212


def auth_manager():
    url = os.environ.get("WP_URL") or input("Site URL (https://sourovdeb.com): ").strip() or "https://sourovdeb.com"
    user = os.environ.get("WP_USER") or input("WP username: ").strip()
    pw = os.environ.get("WP_APP_PASSWORD") or input("WP application password: ").strip()
    return url.rstrip("/"), user, pw


def _req(base, user, pw, path, method="GET"):
    req = urllib.request.Request(base + path, method=method)
    token = base64.b64encode(f"{user}:{pw}".encode()).decode()
    req.add_header("Authorization", "Basic " + token)
    req.add_header("User-Agent", "wp_dedupe_elt365/1.0")
    return req


def api(base, user, pw, path):
    req = _req(base, user, pw, path)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode())


def fetch_all_posts(base, user, pw):
    posts, page = [], 1
    while True:
        path = (f"/wp-json/wp/v2/posts?per_page=100&page={page}"
                f"&status=publish&orderby=date&order=asc"
                f"&_fields=id,title,categories,tags")
        batch = api(base, user, pw, path)
        if not batch:
            break
        posts.extend(batch)
        if len(batch) < 100:
            break
        page += 1
        time.sleep(0.3)
    return posts


def day_number(title):
    if not re.search(r"ELT365", title, re.I):
        return None
    m = re.search(r"Days?(d{1,3})", title, re.I)
    return int(m.group(1)) if m else None


def pick_canonical(variants):
    def score(p):
        cats = p.get("categories", [])
        return (1 if CANON_CAT in cats else 0, len(p.get("tags", [])), -p["id"])
    return sorted(variants, key=score, reverse=True)[0]


def trash_post(base, user, pw, post_id):
    last_err = None
    for attempt in range(4):
        try:
            req = _req(base, user, pw, f"/wp-json/wp/v2/posts/{post_id}", method="DELETE")
            with urllib.request.urlopen(req, timeout=60) as r:
                json.loads(r.read().decode())
            return True
        except urllib.error.HTTPError as e:
            last_err = e
            if e.code in (429, 500, 502, 503):
                time.sleep(15 * (attempt + 1))
                continue
            raise
    print(f"  ! post {post_id}: giving up after retries ({last_err})")
    return False


def main():
    apply = "--apply" in sys.argv
    base, user, pw = auth_manager()
    print("Fetching published posts...")
    posts = fetch_all_posts(base, user, pw)
    print(f"  {len(posts)} published posts")

    by_day = {}
    for p in posts:
        title = (p.get("title") or {}).get("rendered", "")
        d = day_number(title)
        if d is not None and DAY_MIN <= d <= DAY_MAX:
            by_day.setdefault(d, []).append(p)

    to_trash, canonical = [], []
    for d in sorted(by_day):
        variants = by_day[d]
        if len(variants) <= 1:
            continue
        keep = pick_canonical(variants)
        canonical.append((d, keep["id"]))
        to_trash.extend(p["id"] for p in variants if p["id"] != keep["id"])

    dup_days = [d for d in by_day if len(by_day[d]) > 1]
    print(f"\nDays with duplicates: {len(dup_days)}")
    print(f"Canonical keepers:   {len(canonical)}")
    print(f"Posts to trash:       {len(to_trash)}\n")

    if not apply:
        print("DRY RUN - nothing deleted. Rerun with --apply to trash the posts above.")
        for d, cid in canonical:
            print(f"  keep day {d}: id {cid}")
        return

    ok = 0
    for i, pid in enumerate(to_trash, 1):
        if trash_post(base, user, pw, pid):
            ok += 1
        if i % 50 == 0:
            print(f"  {i}/{len(to_trash)} processed, {ok} trashed")
        time.sleep(0.3)

    print(f"\nDone. Moved {ok}/{len(to_trash)} duplicates to trash.")
    print("Recover for 30 days in WP Admin -> Posts -> Trash.")


if __name__ == "__main__":
    main()
