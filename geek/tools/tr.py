"""Usage: tr.py <model> <out_suffix> <video>...  -> writes <video>.<suffix>.json with word timings"""
import json, sys, subprocess, numpy as np
from faster_whisper import WhisperModel
m = WhisperModel(sys.argv[1], device="cpu", compute_type="int8")
for p in sys.argv[3:]:
    raw = subprocess.run(["ffmpeg","-v","error","-i",p,"-ac","1","-ar","16000","-f","s16le","-"],capture_output=True).stdout
    a = np.frombuffer(raw, np.int16).astype(np.float32)/32768
    segs,_ = m.transcribe(a, language="pt", word_timestamps=True, vad_filter=True, beam_size=5)
    words=[]; print(f"== {p}", flush=True)
    for s in segs:
        print(f"[{s.start:.2f}-{s.end:.2f}] {s.text}", flush=True)
        words += [{"text":w.word.strip(),"start":round(w.start,3),"end":round(w.end,3)} for w in s.words]
    json.dump(words, open(f"{p}.{sys.argv[2]}.json","w"), ensure_ascii=False)
