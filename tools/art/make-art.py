#!/usr/bin/env python3
"""놀이터 사진풍 그림 만들기: tools/art/src/*.jpg → public/img/*.webp

원본은 이 프로젝트용으로 이미지 생성 도구로 만든 그림입니다(실제 사진·남의 저작물 아님).
사용: python3 tools/art/make-art.py   (Pillow, numpy 필요)
"""
import pathlib
import numpy as np
from PIL import Image, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parents[2]
SRC, OUT = ROOT / 'tools/art/src', ROOT / 'public/img'
OUT.mkdir(parents=True, exist_ok=True)

def load(name, size=(1024, 576)): return Image.open(SRC / name).convert('RGB').resize(size, Image.LANCZOS)  # 좌표는 이 크기 기준
def save(im, name, q=72, alpha_q=None):
    p = OUT / name
    kw = dict(quality=q, method=6)
    if im.mode == 'RGBA': kw['alpha_quality'] = alpha_q or 80
    im.save(p, 'WEBP', **kw)
    print(f'{name}: {im.size[0]}x{im.size[1]} {p.stat().st_size//1024} KB')

def smooth(a, r=1.2):
    return np.asarray(Image.fromarray((a * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(r)), dtype=np.float32) / 255

# 1) 하늘 (배경, 아주 느리게 움직임)
save(load('sky-day.jpg', (1280, 720)), 'sky-day.webp', 80)
save(load('sky-night.jpg', (1280, 720)), 'sky-night.webp', 78)
save(load('cruise.jpg', (1280, 720)), 'cruise.webp', 80)

# 2) 공항 띠: 하늘을 투명하게 하고 산·도시·터미널·계류장만 남긴다
def airport(name, out, top, bottom, night):
    im = load(name); a = np.asarray(im, dtype=np.float32) / 255
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    h = a.shape[0]
    if night:   # 남색 하늘: 어둡고 파란 기운 → 투명
        sky = (np.maximum(r, g) < .16) & (b < .30)
        keep = np.zeros_like(sky)
        for x in range(sky.shape[1]):
            col = sky[:, x]; nz = np.where(~col[:bottom])[0]
            start = bottom
            for y in nz:  # 작은 점(별·잡티)에 속지 않게 3픽셀 연속 확인
                if y >= top - 40 and y + 3 < h and not col[y:y + 3].any(): start = y; break
            keep[start:, x] = True
        keep = keep.astype(np.float32)
    else:       # 낮: 줄마다 하늘색(가운데값)과 얼마나 다른지로 남길 곳을 정한다 (먼 산은 반투명 = 공기 원근)
        ref = np.median(a[top - 30:top + 18], axis=1)              # 산 위 하늘 줄들
        sky_row = np.concatenate([np.repeat(ref[:1], top - 30, 0), ref, np.repeat(ref[-1:], h - (top + 18), 0)])
        d = np.abs(a - sky_row[:, None, :]).sum(axis=2)
        keep = np.clip((d - .06) / .14, 0, 1)
        keep[top + 70:] = 1                                       # 도시·터미널 아래는 다 남김
    alpha = smooth(keep, 1.0)
    rgba = np.dstack([a, alpha])[top:bottom]
    img = Image.fromarray((rgba * 255).astype('uint8'), 'RGBA')
    save(img, out, 74, 70)
airport('airport-day.jpg', 'airport-day.webp', 258, 462, False)
airport('airport-night.jpg', 'airport-night.webp', 220, 470, True)

# 3) 풀밭 띠 (땅바닥, 좌우로 이어 붙임)
gr = load('airport-day.jpg').crop((0, 470, 1024, 576))
save(gr.resize((1024, 106), Image.LANCZOS), 'grass-day.webp', 66)
gn = load('airport-night.jpg').crop((0, 480, 1024, 576))
save(gn, 'grass-night.webp', 60)

# 4) 구름 조각: 낮 하늘 사진에서 흰 구름만 떼어 앞쪽 구름 층으로
a = np.asarray(load('sky-day.jpg'), dtype=np.float32) / 255
mn = a.min(axis=2); b = a[..., 2]
whit = np.clip((mn - .55) / .3, 0, 1) * np.clip(1 - (b - mn - .05) / .35, 0, 1)
whit = smooth(whit, .8)
crop = slice(180, 470)
rgba = np.dstack([np.clip(a * 1.04, 0, 1), whit])[crop]
save(Image.fromarray((rgba * 255).astype('uint8'), 'RGBA').resize((1024, 290), Image.LANCZOS), 'clouds.webp', 70, 60)
def key_green(im, box=None, width=None):
    """초록 배경을 지우고 가장자리 초록 번짐을 뺀다 → RGBA"""
    p = np.asarray(im, dtype=np.float32) / 255
    r, g, b = p[..., 0], p[..., 1], p[..., 2]
    greenness = g - np.maximum(r, b)
    alpha = smooth(np.clip(1 - (greenness - .12) / .25, 0, 1), .6)
    p2 = p.copy(); p2[..., 1] = g - np.maximum(0, greenness) * .95
    out = Image.fromarray((np.clip(np.dstack([p2, alpha]), 0, 1) * 255).astype('uint8'), 'RGBA')
    if box is None:
        ys, xs = np.where(alpha > .05); box = (xs.min() - 4, ys.min() - 4, xs.max() + 5, ys.max() + 5)
    out = out.crop(box)
    if width: out = out.resize((width, round(out.size[1] * width / out.size[0])), Image.LANCZOS)
    return out

# 5) 비행기 (가로 480px)
save(key_green(load('plane-green.jpg'), width=480), 'plane.webp', 82, 90)
# 6) 먹구름 (번개는 놀이 화면에서 깜빡이게 따로 그림)
save(key_green(load('storm-green.jpg', (1024, 768)), box=(215, 150, 805, 480), width=300), 'storm.webp', 76, 80)
# 7) 달리기 경기장: 위쪽(하늘·관중석·먼 트랙)은 배경, 아래 잔디는 트랙 옆 잔디 무늬로
st = load('stadium.jpg')
save(st.crop((0, 0, 1024, 392)), 'stadium.webp', 72)
save(st.crop((0, 440, 1024, 576)).resize((512, 68), Image.LANCZOS), 'turf.webp', 62)
