# 想法页六宫格背景：从 Enos 提供的设计图 src_tiles.png 裁出六张（内缩 8px 去掉圆角白边），再做柔焦
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance
im = Image.open('src_tiles.png').convert('RGB')
X = [(13, 415), (427, 828), (841, 1243)]; Y = [(114, 604), (630, 1119)]
K = ['all', 'cocreate', 'triage', 'awaiting', 'planned', 'finished']
for i, k in enumerate(K):
    x0, x1 = X[i % 3]; y0, y1 = Y[i // 3]; c = im.crop((x0 + 8, y0 + 8, x1 - 8, y1 - 8))
    # 和记录想法页卡片一致：柔焦 + 轻微提亮去对比，主体可辨但不抢字
    c = c.filter(ImageFilter.GaussianBlur(2.6)); c = ImageEnhance.Contrast(c).enhance(.88); c = Image.blend(c, Image.new('RGB', c.size, (246, 248, 252)), .08)
    # 统一色调：六张都压成同一套冷蓝灰（与记录想法页一致），避免五颜六色
    a = np.asarray(c).astype(float) / 255; L = (a @ [.299, .587, .114])[..., None]
    duo = np.array([62, 86, 132]) / 255 * (1 - L) + np.array([246, 248, 252]) / 255 * L
    c = Image.fromarray((np.clip(a * .16 + duo * .84, 0, 1) * 255).astype('uint8'))
    c.save('it_' + k + '.jpg', quality=84, optimize=True, progressive=True); print(k, c.size)
