#!/usr/bin/env python3
"""Minimaler Site-Mirror fuer nova-works.de -> lokale statische Kopie."""
import os, re, sys, urllib.parse, urllib.request, mimetypes

BASE = "https://nova-works.de"
OUT  = os.path.join(os.path.dirname(os.path.abspath(__file__)), "site")
PAGES = ["/", "/impressum/", "/datenschutzerklaerung/", "/2026/02/06/hallo-welt/"]
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"}

seen = set()

def fetch(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read(), r.headers.get_content_type()

def local_path(url):
    p = urllib.parse.urlparse(url)
    path = urllib.parse.unquote(p.path)
    if path.endswith("/") or path == "":
        path = path + "index.html"
    return os.path.join(OUT, path.lstrip("/"))

def save(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)

def depth_prefix(page_path):
    rel = os.path.relpath(OUT, os.path.dirname(page_path))
    return rel if rel != "." else "."

def grab_asset(url):
    """Laedt ein Asset, gibt lokalen Pfad zurueck (oder None)."""
    url = url.split("#")[0]
    if not url.startswith(BASE):
        return None
    clean = url.split("?")[0]
    lp = local_path(clean)
    if clean in seen:
        return lp
    seen.add(clean)
    try:
        data, _ = fetch(url)
    except Exception as e:
        print(f"  ! {url} -> {e}")
        return None
    save(lp, data)
    print(f"  + {clean[len(BASE):]}  ({len(data)//1024} kB)")
    # CSS: verschachtelte url(...) mitziehen
    if clean.endswith(".css"):
        try:
            css = data.decode("utf-8", "replace")
        except Exception:
            return lp
        for m in set(re.findall(r'url\(\s*[\'"]?([^\'")]+)[\'"]?\s*\)', css)):
            if m.startswith("data:"):
                continue
            sub = urllib.parse.urljoin(clean, m)
            grab_asset(sub)
        css = rewrite(css, lp)
        save(lp, css.encode("utf-8"))
    return lp

def rewrite(text, page_path):
    """Absolute nova-works-URLs -> relative Pfade."""
    pre = depth_prefix(page_path)
    text = text.replace(BASE + "/", pre + "/")
    text = text.replace("https://www.nova-works.de/", pre + "/")
    return text

def do_page(route):
    url = BASE + route
    print(f"\n== {route}")
    html, _ = fetch(url)
    html = html.decode("utf-8", "replace")
    assets = set()
    assets |= set(re.findall(r'<link[^>]+href=["\']([^"\']+)["\']', html))
    assets |= set(re.findall(r'<script[^>]+src=["\']([^"\']+)["\']', html))
    assets |= set(re.findall(r'<img[^>]+src=["\']([^"\']+)["\']', html))
    assets |= set(re.findall(r'data-src=["\']([^"\']+)["\']', html))
    assets |= set(re.findall(r'<source[^>]+src=["\']([^"\']+)["\']', html))
    assets |= set(re.findall(r'srcset=["\']([^"\']+)["\']', html))
    flat = set()
    for a in assets:
        for part in a.split(","):
            u = part.strip().split(" ")[0]
            if u.startswith("//"):
                u = "https:" + u
            u = urllib.parse.urljoin(url, u)
            if u.startswith(BASE):
                flat.add(u)
    for u in sorted(flat):
        grab_asset(u)
    lp = local_path(url)
    save(lp, rewrite(html, lp).encode("utf-8"))
    print(f"  = {lp[len(OUT):]}")

if __name__ == "__main__":
    for r in PAGES:
        do_page(r)
    print("\nfertig ->", OUT)
