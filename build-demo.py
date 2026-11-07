#!/usr/bin/env python3
"""Build the private review copy (demo/) from the built pages: self-contained, no backend, no pixels.
Not part of the site. demo/ is git-ignored. Run after build.py."""
import base64, re
from pathlib import Path
ROOT=Path(__file__).parent
emblem="data:image/png;base64,"+base64.b64encode((ROOT/'assets/emblem.png').read_bytes()).decode()
css=(ROOT/'assets/base.css').read_text(encoding='utf-8')
banner='<div style="background:#fff7e6;border:1px solid #e6c98a;border-radius:10px;padding:8px 12px;text-align:center;font-size:13px;color:#7a5b16;margin-bottom:14px">نسخة تجريبية للمراجعة الداخلية — لا تُحفظ أي بيانات ولا تصل لأي نظام</div>'
def patch(h):
    h=re.sub(r'<link rel="stylesheet" href="/assets/base\.css[^"]*">','<style>'+css.replace('\\','\\\\')+'</style>',h,count=1)
    h=re.sub(r'<script src="/assets/config\.js[^"]*"></script>','<script>window.IF_CONFIG={};</script>',h,count=1)
    h=re.sub(r'/assets/emblem\.png[^"\')]*',emblem,h)
    return h.replace('<div class="wrap">','<div class="wrap">'+banner,1)
(ROOT/'demo/quiz').mkdir(parents=True,exist_ok=True)
f=patch((ROOT/'index.html').read_text(encoding='utf-8'))
f=f.replace('$("#quizBtn").href = res.demo','try{sessionStorage.setItem("ifDemo",JSON.stringify({n:data.childName,a:data.age}));}catch(e){}\n  $("#quizBtn").href = res.demo')
f=f.replace('"/quiz/?t=demo&go=1&n="','"quiz/index.html?t=demo&go=1&n="')
(ROOT/'demo/index.html').write_text(f,encoding='utf-8')
q=patch((ROOT/'quiz/index.html').read_text(encoding='utf-8'))
old='    const qn=(QS.get("n")||"").trim(), qa=parseInt(QS.get("a"),10);\n    if(qn&&qa>=1&&qa<=17){ name=esc(qn); ageNum=qa; band=bandOf(qa); if(GO){ showGpick(); return; }'
assert old in q, "quiz init block changed; update build-demo.py"
q=q.replace(old,'''    let qn=(QS.get("n")||"").trim(), qa=parseInt(QS.get("a"),10), qgo=GO;
    if(!qn){ try{ const d=JSON.parse(sessionStorage.getItem("ifDemo")||"null"); if(d&&d.n){ qn=String(d.n).trim(); qa=parseInt(d.a,10); qgo=true; } }catch(e){} }
    if(qn&&qa>=1&&qa<=17){ name=esc(qn); ageNum=qa; band=bandOf(qa); if(qgo){ showGpick(); return; }''')
(ROOT/'demo/quiz/index.html').write_text(q,encoding='utf-8')
print("demo built")
