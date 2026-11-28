import fs from 'node:fs';
const N=33;
const lines=['TITLE "Kratai black LINE green costume"',`LUT_3D_SIZE ${N}`,'DOMAIN_MIN 0 0 0','DOMAIN_MAX 1 1 1'];
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
const mix=(a,b,t)=>a.map((v,i)=>v*(1-t)+b[i]*t);
for(let bi=0;bi<N;bi++)for(let gi=0;gi<N;gi++)for(let ri=0;ri<N;ri++){
 const rgb=[ri/(N-1),gi/(N-1),bi/(N-1)];
 const [r,g,b]=rgb,max=Math.max(...rgb),min=Math.min(...rgb),d=max-min;
 const s=max===0?0:d/max;
 let h=0;if(d){if(max===r)h=((g-b)/d)%6;else if(max===g)h=(b-r)/d+2;else h=(r-g)/d+4;h=(h*60+360)%360;}
 const blue=smooth(165,190,h)*(1-smooth(245,270,h))*smooth(.18,.45,s);
 const yellow=smooth(25,45,h)*(1-smooth(95,115,h))*smooth(.2,.5,s);
 const green=smooth(90,115,h)*(1-smooth(165,180,h))*smooth(.2,.5,s);
 const shade=.035+.12*max;
 let out=mix(rgb,[shade*.85,shade,shade*.92],blue);
 const v=.38+.42*max;
 out=mix(out,[v*.03,v,v*.42],yellow);
 lines.push(out.map(n=>n.toFixed(6)).join(' '));
}
fs.writeFileSync(new URL('./costume-line.cube',import.meta.url),lines.join('\n'));
