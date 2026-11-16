import json
A='/home/user/capicookies2/geek/completo/assets'
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
r1=json.load(open(f'{A}/parte1.mp4.large.json')); r2=json.load(open(f'{A}/parte2.mp4.large.json'))
w1=retime(r1,[(0,3.32,"Achei o paraíso geek aqui na Irlanda, vamos lá ver como é que é.")])
S2=[(0,2.28,"Literalmente, o paraíso geek."),
(3.80,7.24,"Qualquer mangá que você quiser, qualquer, qualquer um."),
(8.02,10.70,"Procurei e tem todos, tem de todos."),
(12.18,15.64,"Mas o que eu mais achei legal foi as action figures."),
(16.70,19.94,"Olha a riqueza de detalhe, e não tem nenhuma aberta."),
(19.94,23.14,"Mas é 31 euros cada uma dessas."),
(23.14,27.00,"Os mangás são 12 euros,"),
(27.70,31.10,"qualquer um, menos os de capa dura, que são 25 euros."),
(31.10,37.57,"Mas olha quanta action figure legal."),
(40.38,41.42,"Aqui tem mais um monte."),
(42.40,46.44,"Uns são um pouquinho mais caros, outros são mais baratos, mas a média é 31 euros."),
(52.69,53.47,"Olha isso."),
(53.83,57.48,"Com certeza vou colecionar."),
(57.48,60.90,"Vou colecionar um monte."),
(62.86,64.98,"Olha o quanto de ursinho de pelúcia."),
(66.96,67.88,"Muito fofo."),
(70.52,72.30,"É muito macio. Olha o preço."),
(73.04,74.52,"Mas isso aqui é caríssimo."),
(74.52,76.32,"Um ursinho desse é super caro."),
(76.32,78.32,"Olha o Cartman, mano."),
(78.32,82.52,"No dia que eu vim aqui tinha o Butters, mano."),
(82.52,83.40,"O Butters é muito legal."),
(83.40,88.33,"Aqui são as HQs."),
(89.17,91.15,"Qualquer uma aqui é 7 euros."),
(94.02,96.46,"Tem de todas as sagas, todas, todas."),
(96.46,97.74,"Olha o bagulho de FNAF aqui, ó."),
(97.74,98.92,"Pesado pra caralho."),
(98.92,100.18,"Box FNAF."),
(100.18,101.02,"Quanto que é isso?"),
(101.84,103.12,"Pesado, não sei quanto é que é."),
(103.12,104.72,"22 euros..."),
(104.72,105.86,"82 euros."),
(105.86,106.76,"Aí é pra arrombar."),
(106.76,110.66,"Esse sabre de luz vai entrar pra coleção muito em breve."),
(110.66,114.24,"Olha, 300 euros, caro."),
(114.84,118.30,"Na minha opinião, os Funko Pops são a melhor parte."),
(121.20,124.86,"Olha isso, 16 euros, dá pra colecionar com força, hein?"),
(124.86,126.22,"Com força."),
(126.22,131.62,"A minha mãe ama esse, ela ama."),
(131.62,133.40,"O sonho dela é ter esse."),
(133.40,136.88,"E aqui tá 121, no Brasil é quase 4 mil."),
(136.88,139.72,"Bom, essa foi a loja geek."),
(140.54,142.90,"Agora eu vou comprar um HQ pra mim, pra eu treinar meu inglês."),
(142.90,145.82,"Se você quiser alguma coisa de Dublin, saber alguma coisa de Dublin,"),
(145.82,146.88,"comenta aí, me segue,"),
(147.70,149.30,"que eu vou lá pra gravar,"),
(149.30,150.44,"vou mostrar como é que é.")]
w2=retime(r2,S2)
def at(word, after):  # start time of first word containing `word` after time
    return next(s for t,s,e in w2 if word in t and s>=after)
P=[(at("31",19.9),31,"action figure"),(at("12",23),12,"mangá"),(at("25",27.7),25,"mangá capa dura"),
   (at("31",42.4),31,"média das figures"),(at("7",89),7,"HQ"),(at("82",104.7),82,"box FNAF"),
   (at("300",110.6),300,"sabre de luz"),(at("16",121.2),16,"Funko Pop"),(at("121",133.4),121,"Chucky")]
prices=[]
for i,(s,e,l) in enumerate(P):
    nxt=P[i+1][0] if i+1<len(P) else s+99
    prices.append({"start":round(s,3),"eur":e,"label":l,"dur":round(min(3.0,nxt-s-0.05),2)})
# Chucky card stays up through "no Brasil é quase 4 mil"
prices[-1]["dur"]=3.4
d1=3.887; d2=151.588
W=w1+[[t,s+d1,e+d1] for t,s,e in w2]
P2=[dict(p,start=round(p["start"]+d1,3)) for p in prices]
json.dump({"duration":round(d1+d2,3),"rate":6.30,"words":W,"prices":P2,
  "videos":[{"src":"assets/parte1.mp4","start":0,"dur":d1},{"src":"assets/parte2.mp4","start":d1,"dur":d2}]},
  open('spec_all.json','w'),ensure_ascii=False)
for p in P2: print(p)
