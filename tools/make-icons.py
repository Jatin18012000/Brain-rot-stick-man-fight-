#!/usr/bin/env python3
"""Generate the app icons (no image libraries needed).

Renders a stickman-in-guard mark at 4x and box-downsamples it, then writes
PNGs by hand with zlib. Run: python3 tools/make-icons.py
"""
import math
import os
import struct
import zlib

SS = 4  # supersample factor


class Canvas:
    def __init__(self, size):
        self.n = size
        self.buf = [[(0.0, 0.0, 0.0)] * size for _ in range(size)]

    def fill(self, color):
        for y in range(self.n):
            self.buf[y] = [color] * self.n

    def px(self, x, y, color, a=1.0):
        if 0 <= x < self.n and 0 <= y < self.n:
            r, g, b = self.buf[y][x]
            cr, cg, cb = color
            self.buf[y][x] = (r + (cr - r) * a, g + (cg - g) * a, b + (cb - b) * a)

    def disc(self, cx, cy, r, color):
        for y in range(max(0, int(cy - r - 1)), min(self.n, int(cy + r + 2))):
            for x in range(max(0, int(cx - r - 1)), min(self.n, int(cx + r + 2))):
                if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                    self.px(x, y, color)

    def ring(self, cx, cy, r, w, color):
        outer, inner = r + w / 2, r - w / 2
        for y in range(max(0, int(cy - outer - 1)), min(self.n, int(cy + outer + 2))):
            for x in range(max(0, int(cx - outer - 1)), min(self.n, int(cx + outer + 2))):
                d = math.hypot(x - cx, y - cy)
                if inner <= d <= outer:
                    self.px(x, y, color)

    def capsule(self, x0, y0, x1, y1, w, color):
        r = w / 2
        dx, dy = x1 - x0, y1 - y0
        ln2 = dx * dx + dy * dy or 1.0
        lo_x, hi_x = int(min(x0, x1) - r - 1), int(max(x0, x1) + r + 2)
        lo_y, hi_y = int(min(y0, y1) - r - 1), int(max(y0, y1) + r + 2)
        for y in range(max(0, lo_y), min(self.n, hi_y)):
            for x in range(max(0, lo_x), min(self.n, hi_x)):
                t = max(0.0, min(1.0, ((x - x0) * dx + (y - y0) * dy) / ln2))
                px, py = x0 + dx * t, y0 + dy * t
                if math.hypot(x - px, y - py) <= r:
                    self.px(x, y, color)

    def rounded(self, x, y, w, h, r, color):
        for yy in range(max(0, int(y)), min(self.n, int(y + h))):
            for xx in range(max(0, int(x)), min(self.n, int(x + w))):
                cx = min(max(xx, x + r), x + w - r)
                cy = min(max(yy, y + r), y + h - r)
                if math.hypot(xx - cx, yy - cy) <= r:
                    self.px(xx, yy, color)

    def downsample(self, factor):
        n = self.n // factor
        out = Canvas(n)
        inv = 1.0 / (factor * factor)
        for y in range(n):
            for x in range(n):
                r = g = b = 0.0
                for sy in range(factor):
                    for sx in range(factor):
                        pr, pg, pb = self.buf[y * factor + sy][x * factor + sx]
                        r += pr; g += pg; b += pb
                out.buf[y][x] = (r * inv, g * inv, b * inv)
        return out

    def to_png(self, path):
        raw = bytearray()
        for y in range(self.n):
            raw.append(0)
            for x in range(self.n):
                r, g, b = self.buf[y][x]
                raw += bytes((
                    max(0, min(255, int(r * 255 + 0.5))),
                    max(0, min(255, int(g * 255 + 0.5))),
                    max(0, min(255, int(b * 255 + 0.5))),
                ))

        def chunk(tag, data):
            return (struct.pack('>I', len(data)) + tag + data
                    + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff))

        png = b'\x89PNG\r\n\x1a\n'
        png += chunk(b'IHDR', struct.pack('>IIBBBBB', self.n, self.n, 8, 2, 0, 0, 0))
        png += chunk(b'IDAT', zlib.compress(bytes(raw), 9))
        png += chunk(b'IEND', b'')
        with open(path, 'wb') as f:
            f.write(png)


def hexc(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))


def draw(size, maskable=False):
    n = size * SS
    c = Canvas(n)
    c.fill(hexc('#0a0e18'))
    u = n / 100.0  # work in a 0..100 unit space

    # backdrop glow + ring
    c.disc(50 * u, 52 * u, 44 * u, hexc('#131a2c'))
    c.ring(50 * u, 52 * u, 41 * u, 2.2 * u, hexc('#2a3550'))
    c.ring(50 * u, 52 * u, 41 * u, 1.2 * u, hexc('#ffd166'))

    # tower rungs behind the fighter
    for i in range(4):
        y = (26 + i * 13) * u
        c.rounded(24 * u, y, 52 * u, 1.6 * u, 0.8 * u, hexc('#1d2740'))

    body = hexc('#f2f4f8')
    accent = hexc('#ffd166')
    inset = 0.82 if maskable else 1.0

    def P(x, y):
        return (50 * u + (x - 50) * u * inset, 52 * u + (y - 52) * u * inset)

    lw = 4.6 * u * inset
    head = P(44, 26)
    neck = P(46, 36)
    pelvis = P(48, 58)
    c.capsule(*neck, *pelvis, lw * 1.05, body)
    c.disc(head[0], head[1], 7.4 * u * inset, body)

    # front arm mid-punch, back arm guarding
    elbow_f = P(58, 40)
    fist_f = P(76, 36)
    c.capsule(*neck, *elbow_f, lw, body)
    c.capsule(*elbow_f, *fist_f, lw, body)
    c.disc(fist_f[0], fist_f[1], 5.2 * u * inset, accent)

    elbow_b = P(38, 44)
    fist_b = P(46, 32)
    c.capsule(*neck, *elbow_b, lw * 0.9, hexc('#9aa3b5'))
    c.capsule(*elbow_b, *fist_b, lw * 0.9, hexc('#9aa3b5'))

    knee_f = P(58, 72)
    foot_f = P(64, 86)
    c.capsule(*pelvis, *knee_f, lw, body)
    c.capsule(*knee_f, *foot_f, lw, body)

    knee_b = P(38, 72)
    foot_b = P(32, 86)
    c.capsule(*pelvis, *knee_b, lw, hexc('#9aa3b5'))
    c.capsule(*knee_b, *foot_b, lw, hexc('#9aa3b5'))

    # impact spark off the lead fist
    for i in range(6):
        a = i * math.pi / 3 + 0.3
        x0 = fist_f[0] + math.cos(a) * 7 * u * inset
        y0 = fist_f[1] + math.sin(a) * 7 * u * inset
        x1 = fist_f[0] + math.cos(a) * 12 * u * inset
        y1 = fist_f[1] + math.sin(a) * 12 * u * inset
        c.capsule(x0, y0, x1, y1, 1.6 * u * inset, accent)

    return c.downsample(SS)


def main():
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out = os.path.join(here, 'icons')
    os.makedirs(out, exist_ok=True)
    for size in (180, 192, 512):
        draw(size).to_png(os.path.join(out, 'icon-%d.png' % size))
        print('icons/icon-%d.png' % size)
    draw(512, maskable=True).to_png(os.path.join(out, 'icon-512-maskable.png'))
    print('icons/icon-512-maskable.png')


if __name__ == '__main__':
    main()
