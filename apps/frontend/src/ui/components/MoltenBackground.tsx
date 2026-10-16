import { useThemeMode } from '@nightout/ui';
import { useEffect, useRef } from 'react';

/**
 * พื้นหลัง Molten Gold — ริ้วทองเหลวบนพื้นดำ · WebGL ล้วน
 * - fixed เต็มจอ หลังเนื้อหา · pointer-events: none · aria-hidden
 * - ริ้วทองเบนเข้าหาเมาส์ (lerp ลื่น) · ไม่มี click effect
 * - render ครึ่งความละเอียด (ประหยัด GPU ~4x)
 * - prefers-reduced-motion → วาดเฟรมเดียว · แท็บถูกซ่อน → หยุด · light mode → ไม่แสดง
 */
const FRAG = `
precision highp float;
uniform float uTime; uniform vec2 uRes; uniform vec2 uMouse; uniform float uI;
const vec3 BG=vec3(.027,.027,.051); const vec3 GOLD=vec3(.91,.714,.3); const vec3 GOLDH=vec3(1.,.843,.478);
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*noise(p);p=p*2.02+vec2(1.7,9.2);a*=.5;}return v;}
void main(){
  vec2 uv=gl_FragCoord.xy/uRes;
  float asp=uRes.x/uRes.y; vec2 p=(uv-.5)*vec2(asp,1.)*2.; vec2 m=(uMouse-.5)*vec2(asp,1.)*2.;
  vec2 dm=p-m; float d=length(dm); p+=dm*.35*exp(-d*d*1.5);
  float t=uTime*.07;
  float f=fbm(p*.8+vec2(t,-t*.6)+fbm(p*.6-t)*1.2);
  float b=.5+.5*sin(f*11.+p.y*1.2+uTime*.25);
  float sheen=pow(b,5.);
  vec3 col=BG+vec3(.09,.05,.02)*f;
  col+=mix(GOLD*.35,GOLDH*.8,pow(b,14.))*sheen*.55;
  col*=mix(.45,1.,smoothstep(2.4,.3,length(p)));
  gl_FragColor=vec4(mix(BG,col,uI),1.);
}`;
const VERT = 'attribute vec2 a; void main(){ gl_Position=vec4(a,0.,1.); }';
const SCALE = 0.5;

export function MoltenBackground({ intensity = 1 }: { intensity?: number }) {
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
    const uTime = U('uTime'), uRes = U('uRes'), uMouse = U('uMouse'), uI = U('uI');
    gl.uniform1f(uI, intensity);

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
      const k = 1 - Math.exp(-dt * 2.5);
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
      document.addEventListener('visibilitychange', onVis);
      raf = requestAnimationFrame(tick);
    }
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', resize);
      removeEventListener('pointermove', onMove);
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
      className="pointer-events-none fixed inset-0 h-full w-full"
      style={{ zIndex: 0 }}
    />
  );
}
