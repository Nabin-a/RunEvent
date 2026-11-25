import fs from 'node:fs';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {once} from 'node:events';
const root=process.cwd(), source=path.join(root,'กระต่าย_KraTai','ต่าย Move'), dest=path.join(root,'output','line-night');
const files=fs.readdirSync(source).filter(f=>f.endsWith('.mp4')).sort();
const test=process.argv.includes('--test');
const report=[];
for(const file of test?files.slice(0,1):files){
 const input=path.join(source,file),output=path.join(dest,test?'review':'motion',file);
 const probe=JSON.parse(spawnSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',input],{encoding:'utf8'}).stdout);
 const v=probe.streams.find(s=>s.codec_type==='video'),w=v.width,h=v.height,fps=v.r_frame_rate,n=w*h,frameBytes=n*3;
 const background=spawnSync('ffmpeg',['-v','error','-i',path.join(dest,'illustrations','hero-running-track.png'),'-vf',`scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}:iw-ow:0`,'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','pipe:1'],{maxBuffer:30*1024*1024}).stdout;
 if(background.length!==frameBytes)throw Error('Background decode failed');
 const common=test?['-t','3']:[];
 const decoder=spawn('ffmpeg',['-v','error','-i',input,...common,'-f','rawvideo','-pix_fmt','rgb24','pipe:1'],{windowsHide:true,stdio:['ignore','pipe','pipe']});
 const encoder=spawn('ffmpeg',['-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s',`${w}x${h}`,'-r',fps,'-i','pipe:0','-i',input,...common,'-map','0:v','-map','1:a?','-vf','lut3d=file=output/line-night/costume-line.cube','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-c:a','copy','-shortest','-movflags','+faststart',output],{windowsHide:true,stdio:['pipe','ignore','pipe']});
 let errors='';decoder.stderr.on('data',d=>errors+=d);encoder.stderr.on('data',d=>errors+=d);
 const finished=once(encoder,'close'),decoded=once(decoder,'close');
 const mask=new Uint8Array(n),queue=new Int32Array(n);let stash=Buffer.alloc(0),frames=0;
 for await(const chunk of decoder.stdout){
  stash=Buffer.concat([stash,chunk]);
  while(stash.length>=frameBytes){
   const frame=Buffer.from(stash.subarray(0,frameBytes));stash=stash.subarray(frameBytes);mask.fill(0);let head=0,tail=0;
   const visit=(p)=>{if(mask[p])return;const k=p*3,r=frame[k],g=frame[k+1],b=frame[k+2],hi=Math.max(r,g,b),lo=Math.min(r,g,b);if(hi<248&&lo>85&&hi-lo<29){mask[p]=1;queue[tail++]=p;}else mask[p]=2;};
   for(let x=0;x<w;x++){visit(x);visit((h-1)*w+x);}for(let y=1;y<h-1;y++){visit(y*w);visit(y*w+w-1);}
   while(head<tail){const p=queue[head++],x=p%w;if(x>0)visit(p-1);if(x<w-1)visit(p+1);if(p>=w)visit(p-w);if(p<n-w)visit(p+w);}
   for(let p=0;p<n;p++)if(mask[p]===1){const k=p*3;frame[k]=background[k];frame[k+1]=background[k+1];frame[k+2]=background[k+2];}
   if(!encoder.stdin.write(frame))await once(encoder.stdin,'drain');frames++;
  }
 }
 encoder.stdin.end();const [dc]=await decoded,[ec]=await finished;if(dc||ec)throw Error(`${file}: ${errors}`);
 report.push({file,frames,width:w,height:h,fps,sourceDuration:probe.format.duration});
 fs.writeFileSync(path.join(dest,test?'review/test-report.json':'motion-report.json'),JSON.stringify(report,null,2));
 console.log(`Done ${report.length}/${test?1:files.length}: ${file} (${frames} frames)`);
}
