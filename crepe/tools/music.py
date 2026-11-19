"""Generate a ~30 s instrumental background track with MusicGen-small (seeded)."""
import sys, torch, numpy as np, scipy.io.wavfile as wav
from transformers import AutoProcessor, MusicgenForConditionalGeneration
torch.manual_seed(7)
proc = AutoProcessor.from_pretrained("facebook/musicgen-small")
model = MusicgenForConditionalGeneration.from_pretrained("facebook/musicgen-small")
prompt = sys.argv[2] if len(sys.argv) > 2 else "upbeat cheerful lo-fi funk instrumental, warm electric piano, groovy bass, light drums, happy food vlog, 105 bpm"
inp = proc(text=[prompt], padding=True, return_tensors="pt")
audio = model.generate(**inp, do_sample=True, guidance_scale=3, max_new_tokens=1500)  # ~30 s
sr = model.config.audio_encoder.sampling_rate
a = audio[0, 0].numpy(); a = a / max(1e-6, np.abs(a).max()) * 0.9
wav.write(sys.argv[1], sr, (a * 32767).astype(np.int16))
print("ok", len(a) / sr, "s")
