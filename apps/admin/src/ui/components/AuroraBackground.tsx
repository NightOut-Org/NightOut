import { useThemeMode } from '@nightout/ui';
import { useEffect, useRef } from 'react';

/**
 * พื้นหลัง Aurora (ม่วง + ทอง) ของ Backoffice — WebGL ล้วน ไม่ต้องลง three.js / gsap
 * - fixed เต็มจอ หลัง ProLayout · pointer-events: none · aria-hidden
 * - ขยับตามเมาส์ (ลื่นแบบ lerp) · คลิก = คลื่นวง
 * - render ครึ่งความละเอียด (เบลออยู่แล้ว ประหยัด GPU ~4x)
 * - prefers-reduced-motion → วาดเฟรมเดียว · แท็บถูกซ่อน → หยุด · light mode → ไม่แสดง
 */
const FRAG = `
precision highp float;
uniform float uTime; uniform vec2 uRes; uniform vec2 uMouse; uniform float uI; uniform vec3 uClick;
const vec3 BG=vec3(.027,.027,.051); const vec3 GOLD=vec3(.91,.714,.3); const vec3 GOLDH=vec3(1.,.843,.478);
const vec3 PURPLE=vec3(.655,.22,.96); const vec3 VIA=vec3(.118,.043,.2);
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*noise(p);p=p*2.02+vec2(1.7,9.2);a*=.5;}return v;}
float clickWave(vec2 p,float asp){ if(uClick.z<0.) return 0.; float age=uTime-uClick.z; if(age>2.5) return 0.;
  vec2 c=(uClick.xy-.5)*vec2(asp,1.); float d=length(p-c); return exp(-pow((d-age*.55)*9.,2.))*(1.-age/2.5); }
void main(){
  vec2 uv=gl_FragCoord.xy/uRes;
  float asp=uRes.x/uRes.y; vec2 p=(uv-.5)*vec2(asp,1.); vec2 m=(uMouse-.5)*vec2(asp,1.);
  float t=uTime*.045;
  vec2 q=vec2(fbm(p*1.4+t),fbm(p*1.4-t+3.1));
  vec2 r=vec2(fbm(p*1.2+q*1.7+m*.7+t*1.3),fbm(p*1.2+q*1.7-m*.5+5.2));
  float f=fbm(p*1.1+r*1.9);
  vec3 col=mix(BG,VIA*1.35,smoothstep(.2,.8,f));
  col=mix(col,PURPLE*.68,smoothstep(.5,.92,r.x)*.75);
  float edge=smoothstep(.45,.62,r.x)*(1.-smoothstep(.62,.85,r.x));
  col=mix(col,GOLD*.72,edge*smoothstep(.35,.75,q.x)*.7);
  col=mix(col,GOLD*.78,smoothstep(.55,.95,q.y*f*1.8)*.6);
  col+=GOLDH*.06*smoothstep(.6,.9,f*q.y*1.6);
  col+=mix(PURPLE,GOLD,.5)*clickWave(p,asp)*.4;
  col*=mix(.62,1.08,smoothstep(1.35,.15,length(p)));
  gl_FragColor=vec4(mix(BG,col,uI),1.);
}`;
const VERT = 'attribute vec2 a; void main(){ gl_Position=vec4(a,0.,1.); }';
const SCALE = 0.5;

export function AuroraBackground({ intensity = 1 }: { intensity?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { resolved } = useThemeMode();
  const dark = resolved === 'dark';

  useEffect(() => {
    const canvas = ref.current;
    if (!dark || !canvas) return;
    const gl = canvas.getContext('webgl', { antialias: false, powerPreference: 'low-power' });
    if (!gl) return; // ไม่มี WebGL → เหลือพื้น --background ปกติ

    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = (n: string) => gl.getUniformLocation(prog, n);
    const uTime = U('uTime'),
      uRes = U('uRes'),
      uMouse = U('uMouse'),
      uI = U('uI'),
      uClick = U('uClick');
    gl.uniform1f(uI, intensity);
    gl.uniform3f(uClick, 0, 0, -1);

    const resize = () => {
      canvas.width = Math.max(1, Math.round(innerWidth * SCALE));
      canvas.height = Math.max(1, Math.round(innerHeight * SCALE));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
    };
    resize();

    const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
    let time = 0;
    const onMove = (e: PointerEvent) => {
      mouse.tx = e.clientX / innerWidth;
      mouse.ty = 1 - e.clientY / innerHeight;
    };
    const onDown = (e: PointerEvent) =>
      gl.uniform3f(uClick, e.clientX / innerWidth, 1 - e.clientY / innerHeight, time);

    const draw = () => {
      gl.uniform1f(uTime, time);
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(now - last, 50) / 1000;
      last = now;
      time += dt;
      const k = 1 - Math.exp(-dt * 2.5); // ลื่นตามเมาส์
      mouse.x += (mouse.tx - mouse.x) * k;
      mouse.y += (mouse.ty - mouse.y) * k;
      draw();
      raf = requestAnimationFrame(tick);
    };
    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !reduce) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };

    addEventListener('resize', resize);
    if (reduce) {
      time = 4;
      draw();
    } else {
      addEventListener('pointermove', onMove, { passive: true });
      addEventListener('pointerdown', onDown, { passive: true });
      document.addEventListener('visibilitychange', onVis);
      raf = requestAnimationFrame(tick);
    }
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', resize);
      removeEventListener('pointermove', onMove);
      removeEventListener('pointerdown', onDown);
      document.removeEventListener('visibilitychange', onVis);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
    };
  }, [dark, intensity]);

  if (!dark) return null;
  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-0 h-full w-full"
      style={{ zIndex: 0 }}
    />
  );
}
