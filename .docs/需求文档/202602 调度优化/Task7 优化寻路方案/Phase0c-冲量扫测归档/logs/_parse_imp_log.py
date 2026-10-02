# -*- coding: utf-8 -*-
import re
import math
import collections
from pathlib import Path

path = Path(r"d:/repo/Projects/MC/TouHouLittleMaidBE/.docs/需求文档/202602 调度优化/Task7 优化寻路方案/ContentLog2026-10-02_16-33-05_1.txt")
text = path.read_text(encoding="utf-8", errors="replace").splitlines()
imps = []
seen = set()
for line in text:
    if "PATHIMP|META,finish" in line:
        break
    m = re.search(
        r"PATHIMP\|IMP,([^,]+),([^,]+),([^,]+),([^,]+),([^,]+),([^,]+),([^,]+),([^,]+),([^,]+),([^,]+),([^,]+),([^,]+),([^,]+),([^,\s]+)",
        line,
    )
    if not m:
        continue
    hx, hy, trial = float(m.group(1)), float(m.group(2)), int(float(m.group(3)))
    dx, dz, dy = float(m.group(10)), float(m.group(11)), float(m.group(12))
    air = int(float(m.group(13)))
    key = (hx, hy, trial)
    if key in seen:
        continue
    seen.add(key)
    H = math.hypot(dx, dz)
    imps.append(
        dict(hx=hx, hy=hy, trial=trial, dx=dx, dz=dz, dy=dy, H=H, air=air)
    )

print("n_trials", len(imps))
agg = collections.defaultdict(list)
for r in imps:
    agg[(r["hx"], r["hy"])].append(r)
print("n_groups", len(agg))

rows = []
for (hx, hy), arr in sorted(agg.items()):
    mH = sum(a["H"] for a in arr) / len(arr)
    sH = (
        (sum((a["H"] - mH) ** 2 for a in arr) / (len(arr) - 1)) ** 0.5
        if len(arr) > 1
        else 0
    )
    mAir = sum(a["air"] for a in arr) / len(arr)
    rows.append((hx, hy, mH, sH, mAir, len(arr)))

print("hx hy meanH stdH meanAir n")
for r in rows:
    print(f"{r[0]:.2f} {r[1]:.2f} {r[2]:.3f} {r[3]:.3f} {r[4]:.1f} {r[5]}")

print("--- per hy: H≈k*hx ---")
by_hy = collections.defaultdict(list)
for hx, hy, mH, sH, mAir, n in rows:
    by_hy[hy].append((hx, mH, mAir))
for hy in sorted(by_hy):
    xs = by_hy[hy]
    num = sum(hx * mH for hx, mH, _ in xs)
    den = sum(hx * hx for hx, _, _ in xs)
    k = num / den
    print(f"hy={hy:.2f} k={k:.3f} air≈{xs[0][2]:.1f}")

# least squares without numpy
# H = a*hx + b*hy + c*hx*hy + d
n = 4
ATA = [[0.0] * n for _ in range(n)]
ATy = [0.0] * n
for r in imps:
    row = [r["hx"], r["hy"], r["hx"] * r["hy"], 1.0]
    for i in range(n):
        ATy[i] += row[i] * r["H"]
        for j in range(n):
            ATA[i][j] += row[i] * row[j]

# Gaussian elimination
M = [ATA[i][:] + [ATy[i]] for i in range(n)]
for col in range(n):
    piv = max(range(col, n), key=lambda i: abs(M[i][col]))
    M[col], M[piv] = M[piv], M[col]
    div = M[col][col] or 1e-12
    for j in range(col, n + 1):
        M[col][j] /= div
    for i in range(n):
        if i == col:
            continue
        f = M[i][col]
        for j in range(col, n + 1):
            M[i][j] -= f * M[col][j]
coef = [M[i][n] for i in range(n)]
a, b, c, d = coef
print("fit H = a*hx + b*hy + c*hx*hy + d")
print("a,b,c,d", [round(x, 6) for x in coef])


def predH(hx, hy):
    return a * hx + b * hy + c * hx * hy + d


errs = [predH(r["hx"], r["hy"]) - r["H"] for r in imps]
rmse = (sum(e * e for e in errs) / len(errs)) ** 0.5
print("rmse", round(rmse, 4), "maxabs", round(max(abs(e) for e in errs), 4))

print("--- invert hx for target H ---")
for hy in [0.3, 0.4, 0.5, 0.6, 0.7]:
    for Htgt in [2, 3, 4]:
        den = a + c * hy
        hx = (Htgt - b * hy - d) / den
        print(f"  H={Htgt} hy={hy:.1f} => hx≈{hx:.3f} (pred={predH(hx,hy):.3f})")

print("--- current table predicted H (flat runway) ---")
for name, hx, hy in [
    ("2:0", 0.44, 0.42),
    ("3:0", 0.65, 0.48),
    ("4:0", 0.70, 0.52),
    ("2:1", 0.42, 0.55),
    ("3:1", 0.55, 0.62),
    ("4:1", 0.67, 0.68),
    ("2:-1", 0.46, 0.28),
    ("3:-1", 0.6, 0.32),
    ("4:-1", 0.74, 0.35),
]:
    print(f"{name}: predH={predH(hx,hy):.3f}")
