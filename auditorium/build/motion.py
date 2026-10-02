import sys, subprocess, numpy as np
W,H=192,108
for path in sys.argv[1:]:
    p=subprocess.run(['ffmpeg','-loglevel','error','-i',path,'-vf',f'scale={W}:{H}','-f','rawvideo','-pix_fmt','gray','-'],capture_output=True)
    a=np.frombuffer(p.stdout,np.uint8); n=len(a)//(W*H); f=a[:n*W*H].reshape(n,H,W).astype(np.float32)
    d=np.abs(np.diff(f,axis=0)).mean(axis=(1,2))
    thr=max(0.35, d.max()*0.08)
    moving=np.where(d>thr)[0]
    last=moving[-1]+1 if len(moving) else 0
    print(f'{path}: frames={n} motion ends at frame {last} ({last/24:.2f}s); per-sec diff:', ' '.join(f'{d[i*24:(i+1)*24].mean():.2f}' for i in range((n-1)//24+1)))
