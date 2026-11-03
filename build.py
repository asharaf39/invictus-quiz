#!/usr/bin/env python3
"""Generate the per-platform registration pages from src/form.html.

Edit src/form.html once, then run:  python3 build.py
Pixel IDs: fill them in PAGES below (empty = pixel not installed on that page).
"""
from pathlib import Path
import hashlib

ROOT = Path(__file__).parent
TEMPLATE = (ROOT / "src" / "form.html").read_text(encoding="utf-8")

SHARED_SOURCE = "مشاركة من الاختبار"

PAGES = {
    # output folder: settings
    "":       {"source": "زيارة مباشرة", "snap": "", "meta": "", "gtag": ""},
    "snap":   {"source": "سناب شات",     "snap": "797ebb8b-3a15-4855-b7ec-c7c8de54ca33", "meta": "", "gtag": ""},
    "insta":  {"source": "انستجرام",     "snap": "", "meta": "", "gtag": ""},
    "google": {"source": "Google Ads",   "snap": "", "meta": "", "gtag": "AW-10864651559/4ZkxCNvts6AYEKfa1bwo"},
}


def pixel_head(cfg):
    out = []
    if cfg["snap"]:
        out.append(f"""<script>(function(e,t,n){{if(e.snaptr)return;var a=e.snaptr=function(){{a.handleRequest?a.handleRequest.apply(a,arguments):a.queue.push(arguments)}};a.queue=[];var s='script';var r=t.createElement(s);r.async=!0;r.src=n;var u=t.getElementsByTagName(s)[0];u.parentNode.insertBefore(r,u);}})(window,document,'https://sc-static.net/scevent.min.js');snaptr('init','{cfg["snap"]}');snaptr('track','PAGE_VIEW');</script>""")
    if cfg["meta"]:
        out.append(f"""<script>!function(f,b,e,v,n,t,s){{if(f.fbq)return;n=f.fbq=function(){{n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)}};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','{cfg["meta"]}');fbq('track','PageView');</script>""")
    if cfg["gtag"]:
        out.append(f"""<script async src="https://www.googletagmanager.com/gtag/js?id={cfg["gtag"].split("/")[0]}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments)}}gtag('js',new Date());gtag('config','{cfg["gtag"].split("/")[0]}');</script>""")
    return "\n".join(out)


def pixel_fns(cfg):
    calls = []
    if cfg["snap"]:
        calls.append("if(window.snaptr)snaptr('track','SIGN_UP');")
    if cfg["meta"]:
        calls.append("if(window.fbq)fbq('track','Lead');")
    if cfg["gtag"] and "/" in cfg["gtag"]:
        calls.append("if(window.gtag&&phone)gtag('set','user_data',{phone_number:'+'+phone});")
        calls.append(f"if(window.gtag)gtag('event','conversion',{{send_to:'{cfg['gtag']}'}});")
    return "function trackLead(phone){" + "".join(calls) + "}"


def bust(html):
    """Add ?v=<content hash> to /assets/ files so browsers and Hostinger's CDN (7-day cache) fetch new versions."""
    for name in ["config.js", "base.css", "emblem.png"]:
        h = hashlib.md5((ROOT / "assets" / name).read_bytes()).hexdigest()[:8]
        html = html.replace(f"/assets/{name}", f"/assets/{name}?v={h}")
    return html


for folder, cfg in PAGES.items():
    html = (TEMPLATE
            .replace("{{SOURCE}}", cfg["source"])
            .replace("{{SOURCE_SHARED}}", SHARED_SOURCE)
            .replace("{{PIXEL_HEAD}}", pixel_head(cfg))
            .replace("{{PIXEL_FNS}}", pixel_fns(cfg)))
    out_dir = ROOT / folder if folder else ROOT
    out_dir.mkdir(exist_ok=True)
    (out_dir / "index.html").write_text(bust(html), encoding="utf-8")
    print("built", (folder or "/") , "->", cfg["source"])

# quiz page: src/quiz.html + src/quiz-data.js (questions, types, texts)
quiz = (ROOT / "src" / "quiz.html").read_text(encoding="utf-8").replace(
    "{{QUIZ_DATA}}", (ROOT / "src" / "quiz-data.js").read_text(encoding="utf-8"))
(ROOT / "quiz").mkdir(exist_ok=True)
(ROOT / "quiz" / "index.html").write_text(bust(quiz), encoding="utf-8")
print("built /quiz")
