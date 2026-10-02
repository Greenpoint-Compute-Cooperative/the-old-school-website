import sys, subprocess, numpy as np
W,H=192,108
def frames(path):
    p=subprocess.run(['ffmpeg','-loglevel','error','-i',path,'-vf',f'scale={W}:{H}','-f','rawvideo','-pix_fmt','gray','-'],capture_output=True)
    a=np.frombuffer(p.stdout,np.uint8); n=len(a)//(W*H); return a[:n*W*H].reshape(n,H,W).astype(np.float32)
def shift(a,b):
    win=np.outer(np.hanning(H),np.hanning(W))
    A=np.fft.fft2((a-a.mean())*win); B=np.fft.fft2((b-b.mean())*win)
    R=A*np.conj(B); R/=np.abs(R)+1e-6; r=np.fft.ifft2(R).real
    y,x=np.unravel_index(np.argmax(r),r.shape)
    if x>W//2: x-=W
    if y>H//2: y-=H
    return x,y
for path in sys.argv[1:]:
    f=frames(path); fps=24
    dx=[shift(f[i],f[i+1])[0] for i in range(len(f)-1)]
    secs=[dx[i*fps:(i+1)*fps] for i in range((len(dx)+fps-1)//fps)]
    # content moving LEFT in frame (negative dx a->b means b is shifted left) == camera panning RIGHT
    print(path, ' per-second mean dx (px/frame; + = content moves right = camera pans LEFT):')
    print('   ', ' '.join(f'{np.mean(s):+.2f}' for s in secs))
