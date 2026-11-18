#!/usr/bin/env python3
"""한글 글꼴을 필요한 글자만 남겨 작게 만든다.

남기는 글자
  - KS X 1001 완성형 한글 2,350자 (일상 글자 거의 전부)
  - 한글 낱자(ㄱ~ㅣ, U+3131-318E) — 받침·소리 놀이에서 씀
  - 기본 라틴 문자·숫자·문장부호, 자주 쓰는 기호(· … ‘’ “” ★ 등)
  - public/ 안의 html·js·css 에 실제로 적힌 글자 전부 (완성형 밖 글자 포함)
완성형 밖의 드문 글자(예: 똠, 쀍)를 아이 이름·메모에 쓰면 그 글자만 기기 기본 글꼴로 보인다.

사용: pip install fonttools brotli  →  python3 tools/fonts/subset.py
원본: tools/fonts/src/*.woff2  →  결과: public/fonts/<이름>.core.woff2 / .rest.woff2
화면에 쓰는 글자(core)를 먼저 받고, 나머지 완성형 글자(rest)는 그 글자가 화면에 나올 때만 받는다
(unicode-range). public/app.css 의 fonts:start~fonts:end 부분도 다시 만든다.
화면 문구를 바꾸면 이 스크립트를 다시 돌린다 (안 돌려도 새 글자는 rest 에서 받아져 잘 보인다).
"""
import glob, os, pathlib, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
SRC, OUT = ROOT / 'tools/fonts/src', ROOT / 'public/fonts'

def ksx1001():
    out = []
    for hi in range(0xB0, 0xC9):
        for lo in range(0xA1, 0xFF):
            try:
                out.append(bytes([hi, lo]).decode('euc-kr'))
            except UnicodeDecodeError:
                pass
    return ''.join(c for c in out if '\uac00' <= c <= '\ud7a3')

def used_in_repo():
    s = set()
    for pat in ('public/**/*.html', 'public/**/*.js', 'public/**/*.css', 'public/manifest.webmanifest'):
        for f in glob.glob(str(ROOT / pat), recursive=True):
            if f.endswith('world-map.js'):
                continue
            s.update(open(f, encoding='utf-8').read())
    return ''.join(c for c in s if ord(c) >= 0x20 and not (0x1F000 <= ord(c) <= 0x1FFFF))

FACES = [  # (원본 파일, 글꼴 이름, 굵기)
    ('HadaCondensed-Regular', 'Hada', 400), ('HadaCondensed-Bold', 'Hada', 700),
    ('KkakdugiDrafting-Bold', 'Kkakdugi', 400), ('SeoulAlrim-Bold', 'SeoulAlrim', 700),
    ('YaongEomma', 'YaongEomma', 400), ('Neujot-Bold', 'Neujot', 400),
]

def ranges(cps):
    cps = sorted(set(cps)); out = []; s = p = cps[0]
    for c in cps[1:]:
        if c == p + 1: p = c; continue
        out.append((s, p)); s = p = c
    out.append((s, p))
    return ','.join(f'U+{a:X}' if a == b else f'U+{a:X}-{b:X}' for a, b in out)

def run(src, text, dst):
    tmp = ROOT / 'tools/fonts/.chars.txt'
    tmp.write_text(text, encoding='utf-8')
    subprocess.run([sys.executable, '-m', 'fontTools.subset', str(src), f'--text-file={tmp}',
                    '--flavor=woff2', '--layout-features=*', '--no-hinting', '--desubroutinize',
                    f'--output-file={dst}'], check=True, stderr=subprocess.DEVNULL)
    tmp.unlink()

def main():
    hangul = ksx1001()
    assert len(hangul) == 2350, len(hangul)
    jamo = ''.join(chr(c) for c in range(0x3131, 0x318F))
    ascii_ = ''.join(chr(c) for c in range(0x20, 0x7F))
    extra = '·…‘’“”–—•※★☆♥♡○●◎◇◆□■△▲▽▼→←↑↓↔×÷±°℃₩、。「」『』《》〈〉【】〜'
    # 화면 글자(core): 코드에 적힌 글자 + 낱자 + 영문·기호. 처음 열 때 이것만 받는다.
    core = ''.join(sorted(set(jamo + ascii_ + extra + used_in_repo())))
    # 나머지(rest): 완성형 한글 중 core 에 없는 글자. 이름·메모에 그런 글자가 나올 때만 받는다.
    rest = ''.join(sorted(set(hangul) - set(core)))
    OUT.mkdir(parents=True, exist_ok=True)
    for f in OUT.glob('*.woff2'):
        if not f.name.startswith('Andika'): f.unlink()
    css = ['/* fonts:start — tools/fonts/subset.py 가 만든 부분 (직접 고치지 말 것) */']
    core_range = ranges([ord(c) for c in core])
    total0 = total1 = 0
    for name, fam, wt in FACES:
        src = SRC / f'{name}.woff2'
        run(src, core, OUT / f'{name}.core.woff2'); run(src, rest, OUT / f'{name}.rest.woff2')
        a, b = (OUT / f'{name}.core.woff2').stat().st_size, (OUT / f'{name}.rest.woff2').stat().st_size
        total0 += src.stat().st_size; total1 += a
        print(f'{name}: 원본 {src.stat().st_size//1024} KB → 화면 글자 {a//1024} KB (+필요할 때 {b//1024} KB)')
        # 나중에 적힌 글꼴부터 먼저 찾으므로 rest 를 먼저, core 를 뒤에 적는다
        css.append(f'@font-face{{font-family:"{fam}";src:url(/fonts/{name}.rest.woff2) format("woff2");font-weight:{wt};font-display:swap;unicode-range:U+AC00-D7A3}}')
        css.append(f'@font-face{{font-family:"{fam}";src:url(/fonts/{name}.core.woff2) format("woff2");font-weight:{wt};font-display:swap;unicode-range:{core_range}}}')
    css.append('@font-face{font-family:"Andika";src:url(/fonts/Andika-Regular.woff2) format("woff2");font-weight:400;font-display:swap;unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}')
    css.append('@font-face{font-family:"Andika";src:url(/fonts/Andika-Bold.woff2) format("woff2");font-weight:700;font-display:swap;unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}')
    css.append('/* fonts:end */')
    app = ROOT / 'public/app.css'
    t = app.read_text(encoding='utf-8')
    if '/* fonts:start' in t:
        a = t.index('/* fonts:start'); b = t.index('/* fonts:end */') + len('/* fonts:end */')
        t = t[:a] + '\n'.join(css) + t[b:]
    else:
        lines = [l for l in t.split('\n') if not l.startswith('@font-face')]
        lines.insert(1, '\n'.join(css)); t = '\n'.join(lines)
    app.write_text(t, encoding='utf-8')
    print(f'처음 받는 글꼴 합계 {total0//1024} KB → {total1//1024} KB, 화면 글자 {len(core)}자 / 나머지 {len(rest)}자')

if __name__ == '__main__':
    main()
