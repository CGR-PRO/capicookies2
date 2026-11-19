import json
A='/home/user/capicookies2/crepe/completo/assets'
def retime(raw, segs):
    out=[]
    for s,e,text in segs:
        ow=[w for w in raw if w['start']>=s-0.05 and w['start']<e-0.02]
        nw=text.split()
        if ow and len(ow)==len(nw):
            out+=[[t,w['start'],w['end']] for t,w in zip(nw,ow)]; continue
        a=ow[0]['start'] if ow else s; b=ow[-1]['end'] if ow else e
        tot=sum(len(x)+1 for x in nw); t=a
        for x in nw:
            d=(b-a)*(len(x)+1)/tot; out.append([x,round(t,3),round(t+d*0.92,3)]); t+=d
    return out
r1=json.load(open(f'{A}/fala1.mp4.large.json')); r2=json.load(open(f'{A}/parte2.mp4.large.json'))
print(r2)
w1=retime(r1,[(0,2.4,"Agora a gente vai comer aqui no Gino's Gelato, no crepe."),
              (5.6,7.5,"Aqui tem sempre porteiros do gás.")])
w2=retime(r2,[(0,4.84,"Hum! Nossa, muito bom! Muito bom, hein?"),(5.08,5.64,"Muito bom!")])
d1=87.8; d2=9.17
json.dump({"duration":round(d1+d2,3),"words":w1+[[t,s+d1,e+d1] for t,s,e in w2],"prices":[],
  "videos":[{"src":"assets/parte1.mp4","start":0,"dur":d1},{"src":"assets/parte2.mp4","start":d1,"dur":d2}]},
  open('/home/user/capicookies2/crepe/tools/spec_all.json','w'),ensure_ascii=False)
