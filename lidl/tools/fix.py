import json, re, sys
def retime(raw, segs):
    out=[]
    for s,e,text in segs:
        ow=[w for w in raw if w['start']>=s-0.05 and w['start']<e-0.02]
        nw=text.split()
        if ow and len(ow)==len(nw):
            out+= [[t,w['start'],w['end']] for t,w in zip(nw,ow)]; continue
        a=ow[0]['start'] if ow else s; b=ow[-1]['end'] if ow else e
        tot=sum(len(x)+1 for x in nw); t=a
        for x in nw:
            d=(b-a)*(len(x)+1)/tot; out.append([x,round(t,3),round(t+d*0.92,3)]); t+=d
    return out
L='/home/user/capicookies2/lidl'
v2=json.load(open(f'{L}/v2/assets/words_raw.json'))
S2=[
(0.40,2.40,"Achei no Lidl o macaron,"),
(3.78,4.98,"quase cinco euros."),
(4.98,7.24,"No Brasil é os olhos da cara."),
(7.74,8.88,"Vamos pegar uma carne"),
(8.88,10.90,"pra gente fazer um macarrão com carne moída."),
(14.52,16.02,"O preço tá em cima:"),
(17.18,18.48,"quatro e dezenove."),
(18.48,20.10,"Se tiver o Plus é três e sessenta e nove,"),
(20.10,22.02,"mas a gente não fez o aplicativo ainda."),
(22.82,25.64,"Agora a gente vai pegar um macarrão e ovo."),
(26.22,28.02,"Vou pegar esse óleo aqui,"),
(29.62,30.80,"dois e cinquenta,"),
(30.80,31.38,"pra fazer o macarrão."),
(31.38,33.68,"Eu acho que é azeite, mas não tenho certeza."),
(33.68,37.02,"Um potinho de orégano"),
(37.02,37.43,"por"),
(39.51,40.87,"sessenta e nove..."),
(40.87,41.79,"sessenta e nove centavos."),
(42.69,44.67,"Vou pegar esse molho"),
(44.67,45.71,"à bolonhesa,"),
(46.63,48.67,"três e quarenta e nove."),
(48.67,50.45,"Um macarrão"),
(50.45,51.97,"penne por"),
(51.97,54.31,"cinquenta e nove centavos."),
(54.31,56.31,"Um euro,"),
(56.31,58.23,"um pão de forma."),
(59.39,60.89,"Eu não vou comprar esse,"),
(60.89,61.91,"mas achei legal mostrar."),
(62.61,64.31,"Pra alguém saber o que é isso, mano."),
(64.31,66.01,"Me fala, por favor."),
(66.01,68.01,"O nome é..."),
(69.15,69.67,"sei lá."),
(70.71,72.37,"Pegar uma cebola."),
(72.37,74.81,"Eu não sei quanto que vai dar, mas dois quilos é"),
(74.81,75.85,"um e oitenta e nove."),
(75.85,78.77,"E o garlic, o alho,"),
(78.77,80.69,"um e dezenove."),
(80.69,82.37,"Dezoito ovos,"),
(82.79,83.99,"seis euros."),
(84.65,85.37,"Dá uma olhada aqui."),
(86.89,90.10,"Tudo caipira aqui,"),
(90.10,91.52,"não tem ovo branco."),
(93.60,96.66,"Suco de laranja, dois e setenta e cinco."),
(97.34,98.30,"Pegar um"),
(98.30,100.18,"sabão em cápsula pra lavar a roupa."),
(101.34,102.30,"Cinco euros."),
(102.30,104.52,"Caro, hein? Caro demais."),
(106.05,108.85,"Uma pomba cagou no Arthur ontem."),
(108.85,109.89,"Aqui na parte de bebida"),
(109.89,111.45,"eles têm essa porta aqui. Depois das dez"),
(111.45,113.87,"eles não podem mais vender bebida, porque o pessoal"),
(114.55,115.79,"aqui faz muita merda"),
(115.79,117.85,"quando bebe, porque eles bebem"),
(117.85,118.93,"todos os dias."),
(121.36,123.90,"Só queria dar uma olhada no preço das bebidas."),
(129.18,134.20,"E é isso aí."),
(134.20,135.90,"Por último, cotton buds"),
(135.90,137.80,"por noventa e nove centavos."),
(137.80,139.74,"Aqui todos os caixas"),
(139.74,141.28,"são automáticos."),
(141.28,144.64,"Não tem ninguém passando pra vocês."),
(144.64,145.80,"Só tem umas duas,"),
(145.80,147.36,"três mulheres ali que estão auxiliando."),
]
w2=retime(v2,S2)
P2=[(0.6,4.49,"macaron"),(17.18,4.19,"carne moída"),(18.6,3.69,"com Lidl Plus"),(29.62,2.50,"óleo"),(39.51,0.69,"orégano"),(46.63,3.49,"molho bolonhesa"),(51.97,0.59,"macarrão"),(54.31,0.99,"pão de forma"),(74.81,1.89,"cebola 2 kg"),(78.77,1.19,"alho"),(82.0,6.29,"18 ovos"),(94.6,2.75,"suco de laranja"),(101.0,5.39,"sabão em cápsula"),(135.9,0.99,"cotton buds")]
def pr(P,durs=None):
    o=[]
    for i,(s,e,l) in enumerate(P):
        nxt=P[i+1][0] if i+1<len(P) else s+99
        o.append({"start":s,"eur":e,"label":l,"dur":round(min(2.8,nxt-s-0.05),2)})
    return o
json.dump({"duration":148.79,"words":w2,"prices":pr(P2)},open('spec2.json','w'),ensure_ascii=False)
# v1 / v3 from large-v3
v1=json.load(open(f'{L}/v1/assets/words_large.json'))
w1=retime(v1,[(0.0,2.32,"E aí, vem comigo fazer uma compra aqui na Lidl."),(2.32,3.6,"Vamos ver quanto que vai ficar?")])
json.dump({"duration":4.35,"words":w1,"prices":[]},open('spec1.json','w'),ensure_ascii=False)
v3=json.load(open(f'{L}/v3/assets/words_large.json'))
w3=retime(v3,[(0.2,2.7,"Eu tô passando as compras ainda."),(3.7,5.94,"Até agora deu 17 euros."),(5.94,9.2,"O total da nossa compra deu 27 euros."),(9.2,11.7,"Vocês acham barato ou caro?")])
json.dump({"duration":12.71,"words":w3,"prices":[{"start":4.6,"eur":17.0,"label":"até agora","dur":1.9},{"start":7.6,"eur":27.06,"label":"total da compra","dur":4.9}]},open('spec3.json','w'),ensure_ascii=False)
print(w1);print(w3)
