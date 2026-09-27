import sys, subprocess, numpy as np
W,H=192,108
def load(path):
    p=subprocess.run(['ffmpeg','-loglevel','error','-i',path,'-vf',f'scale={W}:{H}','-f','rawvideo','-pix_fmt','gray','-'],capture_output=True)
    a=np.frombuffer(p.stdout,np.uint8); n=len(a)//(W*H); return a[:n*W*H].reshape(n,H,W).astype(np.float32)
THR=1.6  # mean abs gray diff vs boundary frame below which a frame counts as "still"
for path in sys.argv[1:]:
    f=load(path); n=len(f)
    d0=np.abs(f-f[0]).mean(axis=(1,2)); d1=np.abs(f-f[-1]).mean(axis=(1,2))
    s=int(np.argmax(d0>THR)) if (d0>THR).any() else n
    e=n-1-int(np.argmax(d1[::-1]>THR)) if (d1>THR).any() else 0
    print(f'{path}: n={n}  start-hold {s} fr ({s/24:.2f}s)  end-hold {n-1-e} fr -> keep {s/24:.2f}s..{(e+1)/24:.2f}s')
