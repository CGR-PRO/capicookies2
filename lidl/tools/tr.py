import json, sys, subprocess, numpy as np
from faster_whisper import WhisperModel
m = WhisperModel("medium", device="cpu", compute_type="int8")
for n in sys.argv[1:]:
    p=f"/home/user/capicookies2/lidl/v{n}/assets/source.mp4"
    raw=subprocess.run(["ffmpeg","-v","error","-i",p,"-ac","1","-ar","16000","-f","s16le","-"],capture_output=True).stdout
    a=np.frombuffer(raw,np.int16).astype(np.float32)/32768
    segs,_=m.transcribe(a, language="pt", word_timestamps=True, vad_filter=True, beam_size=5)
    words=[]; text=[]
    for s in segs:
        text.append(f"[{s.start:.2f}-{s.end:.2f}] {s.text}")
        for w in s.words:
            words.append({"text":w.word.strip(),"start":round(w.start,3),"end":round(w.end,3)})
    json.dump(words, open(f"/home/user/capicookies2/lidl/v{n}/assets/words_raw.json","w"), ensure_ascii=False, indent=0)
    print(f"== v{n}"); print("\n".join(text), flush=True)
