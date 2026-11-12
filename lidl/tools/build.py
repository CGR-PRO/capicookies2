"""Build a HyperFrames project (index.html + compositions) from a spec JSON.

spec = {
  "duration": float,
  "words": [[text, start, end], ...],      # caption words, in order
  "breaks": [index, ...],                   # optional forced group starts (word index)
  "prices": [{"eur": 4.19, "start": 17.2, "dur": 2.6, "label": "carne"}],
}
"""
import json, sys, html, os

RATE = 6.20  # 1 EUR = R$ 6,20 (comercial, 11/11/2026)
W, H = 1080, 1920
MAXW = 4  # max words per group (TikTok energy)


def brl(v):
    return f"{v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def groups_from(words, breaks):
    groups, cur = [], []
    brk = set(breaks or [])
    for i, w in enumerate(words):
        if cur:
            prev = words[i - 1]
            gap = w[1] - prev[2]
            end_sent = prev[0].endswith((".", "!", "?", ","))
            if len(cur) >= MAXW or gap >= 0.35 or end_sent or i in brk:
                groups.append(cur)
                cur = []
        cur.append((i, w))
    if cur:
        groups.append(cur)
    # fold a dangling single word into the previous group when it follows closely
    out = []
    for g in groups:
        if out and len(g) == 1 and len(out[-1]) <= 4 and g[0][1][1] - out[-1][-1][1][2] < 0.35 \
                and g[0][0] not in brk:
            out[-1] = out[-1] + g
        else:
            out.append(g)
    return out


def clean(t):
    return t.strip().strip(",.!?").upper()


def main(spec_path, proj):
    spec = json.load(open(spec_path))
    dur = spec["duration"]
    words = spec["words"]
    groups = groups_from(words, spec.get("breaks"))

    # ---------- captions composition ----------
    cap_html, cap_js = [], []
    for gi, g in enumerate(groups):
        gs = max(0.1, g[0][1][1] - 0.05)
        nxt = groups[gi + 1][0][1][1] - 0.02 if gi + 1 < len(groups) else dur
        ge = min(max(g[-1][1][2] + 0.25, gs + 0.5), nxt, dur)
        gid = f"cg{gi}"
        spans = []
        for (wi, w) in g:
            spans.append(f'<span class="w" id="cw{wi}">{html.escape(clean(w[0]))}</span>')
        cap_html.append(
            f'<div class="cap clip" id="{gid}" data-start="{gs:.3f}" data-duration="{ge-gs:.3f}">'
            f'<div class="line" id="{gid}-l">{"".join(spans)}</div></div>'
        )
        cap_js.append(
            f'tl.fromTo("#{gid}-l",{{scale:0.78,y:18}},{{scale:1,y:0,duration:0.16,ease:"back.out(2.6)"}},{gs:.3f});'
        )
        for (wi, w) in g:
            ws, we = w[1], min(w[2], ge)
            cap_js.append(
                f'tl.fromTo("#cw{wi}",{{color:"#ffffff",scale:1}},{{color:"#FFE21A",scale:1.08,duration:0.06,ease:"power2.out"}},{ws:.3f});'
            )
            cap_js.append(
                f'tl.to("#cw{wi}",{{color:"#ffffff",scale:1,duration:0.06}},{max(we, ws+0.12):.3f});'
            )

    captions = f"""<template>
  <style>
    #captions {{ position:absolute; inset:0; pointer-events:none; }}
    #captions .cap {{ position:absolute; left:0; right:0; top:1090px; height:260px;
      display:flex; align-items:center; justify-content:center; overflow:visible; }}
    #captions .line {{ width:900px; text-align:center; font-family:"Montserrat"; font-weight:900;
      font-size:84px; line-height:1.08; letter-spacing:-0.01em; color:#fff;
      -webkit-text-stroke:14px #000; paint-order:stroke fill;
      text-shadow:0 6px 0 rgba(0,0,0,.55), 0 10px 24px rgba(0,0,0,.45); }}
    #captions .w {{ display:inline-block; transform-origin:50% 60%; margin:0 0.13em; }}
  </style>
  <div id="captions" data-composition-id="captions" data-width="{W}" data-height="{H}" data-layout-allow-overflow>
    {chr(10).join("    " + c for c in cap_html)}
  </div>
  <script>
    const tl = gsap.timeline({{ paused: true }});
    {chr(10).join("    " + j for j in cap_js)}
    window.__timelines["captions"] = tl;
  </script>
</template>
"""

    # ---------- prices composition ----------
    pr_html, pr_js = [], []
    for pi, p in enumerate(spec.get("prices", [])):
        s, d = p["start"], p.get("dur", 2.6)
        d = min(d, dur - s)
        eur = brl(p["eur"])
        real = brl(p["eur"] * RATE)
        label = html.escape(p.get("label", "").upper())
        rot = -3 if pi % 2 == 0 else 3
        pid = f"pc{pi}"
        lab = f'<div class="pl">{label}</div>' if label else ""
        pr_html.append(
            f'<div class="price clip" id="{pid}" data-start="{s:.3f}" data-duration="{d:.3f}">'
            f'<div class="card" id="{pid}-c" style="--r:{rot}deg">{lab}'
            f'<div class="eur">€ {eur}</div><div class="brl" id="{pid}-b">≈ R$ {real}</div></div></div>'
        )
        pr_js.append(
            f'tl.fromTo("#{pid}-c",{{scale:0.3,rotation:{rot*4},opacity:0}},{{scale:1,rotation:{rot},opacity:1,duration:0.32,ease:"back.out(2.2)"}},{s:.3f});'
        )
        pr_js.append(
            f'tl.fromTo("#{pid}-b",{{scale:0.6,opacity:0}},{{scale:1,opacity:1,duration:0.22,ease:"back.out(3)"}},{s+0.28:.3f});'
        )
        pr_js.append(
            f'tl.to("#{pid}-c",{{scale:0.6,opacity:0,duration:0.16,ease:"power2.in"}},{s+d-0.18:.3f});'
        )

    prices = f"""<template>
  <style>
    #prices {{ position:absolute; inset:0; pointer-events:none; }}
    #prices .price {{ position:absolute; left:0; right:0; top:250px; height:360px;
      display:flex; align-items:center; justify-content:center; overflow:visible; }}
    #prices .card {{ background:#fff; border-radius:34px; padding:26px 54px 30px;
      border:7px solid #111; box-shadow:0 14px 0 #111, 0 24px 50px rgba(0,0,0,.45);
      text-align:center; font-family:"Montserrat"; }}
    #prices .pl {{ font-weight:800; font-size:34px; color:#444; letter-spacing:.06em; margin-bottom:2px; }}
    #prices .eur {{ font-weight:900; font-size:116px; line-height:1; color:#0050AA; letter-spacing:-0.02em; }}
    #prices .brl {{ display:inline-block; margin-top:14px; background:#009C3B; color:#fff;
      font-weight:900; font-size:56px; padding:8px 28px 10px; border-radius:999px; border:5px solid #111; }}
  </style>
  <div id="prices" data-composition-id="prices" data-width="{W}" data-height="{H}" data-layout-allow-overflow>
    {chr(10).join("    " + c for c in pr_html)}
  </div>
  <script>
    const tl = gsap.timeline({{ paused: true }});
    {chr(10).join("    " + j for j in pr_js)}
    window.__timelines["prices"] = tl;
  </script>
</template>
"""

    index = f"""<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width={W}, height={H}" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>
      * {{ margin:0; padding:0; box-sizing:border-box; }}
      html, body {{ width:{W}px; height:{H}px; overflow:hidden; background:#000; }}
      #root {{ position:relative; width:100%; height:100%; }}
      #footage {{ position:absolute; inset:0; width:100%; height:100%; object-fit:cover; z-index:0; }}
      #captions {{ z-index:2; }}
      #prices {{ z-index:3; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{dur:.3f}" data-width="{W}" data-height="{H}">
      <video id="footage" class="clip" src="assets/source.mp4" data-start="0" data-duration="{dur:.3f}" data-track-index="0" data-has-audio="true"></video>
      <div id="prices" data-composition-id="prices" data-composition-src="compositions/prices.html" data-start="0" data-duration="{dur:.3f}" data-track-index="2" data-track-kind="graphics" data-width="{W}" data-height="{H}"></div>
      <div id="captions" data-composition-id="captions" data-composition-src="compositions/captions.html" data-start="0" data-duration="{dur:.3f}" data-track-index="1" data-track-kind="captions" data-width="{W}" data-height="{H}"></div>
    </div>
    <script>
      window.__timelines["main"] = gsap.timeline({{ paused: true }});
    </script>
  </body>
</html>
"""
    os.makedirs(f"{proj}/compositions", exist_ok=True)
    open(f"{proj}/index.html", "w").write(index)
    open(f"{proj}/compositions/captions.html", "w").write(captions)
    open(f"{proj}/compositions/prices.html", "w").write(prices)
    print(f"{proj}: {len(groups)} caption groups, {len(spec.get('prices', []))} prices")
    for g in groups:
        print("  ", f"{g[0][1][1]:6.2f}", " ".join(w[0] for _, w in g))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
