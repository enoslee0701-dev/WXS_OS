# 想法页六宫格背景：在真实感素材上做彩色调色（duotone + 保留原色），输出 it_*.jpg
import numpy as np
from PIL import Image, ImageEnhance
W, H = 300, 380
def fit(im, box=None):
    im = im.convert('RGB')
    if box: im = im.crop(box)
    r = max(W / im.width, H / im.height); im = im.resize((round(im.width * r) + 1, round(im.height * r) + 1), Image.LANCZOS)
    x = (im.width - W) // 2; y = (im.height - H) // 2
    return im.crop((x, y, x + W, y + H))
def tone(im, dark, light, mix=.72, sat=1.15):
    a = np.asarray(im).astype(float) / 255; L = (a @ [.299, .587, .114])[..., None]
    L = np.clip((L - L.min()) / (L.max() - L.min() + 1e-6), 0, 1) ** 1.25
    duo = np.array(dark) / 255 * (1 - L) + np.array(light) / 255 * L
    out = Image.fromarray((np.clip(a * (1 - mix) + duo * mix, 0, 1) * 255).astype('uint8'))
    return ImageEnhance.Color(out).enhance(sat)
def save(im, k): im.save('it_' + k + '.jpg', quality=82, optimize=True, progressive=True); print(k, im.size)
P = lambda n: Image.open(n + '.jpg')
save(tone(fit(P('proj_hero'), (760, 60, 1100, 505)), (122, 74, 20), (255, 236, 200), .45, 1.3), 'all')       # 晨光书桌：暖金
save(tone(fit(P('pt_hr')), (70, 40, 160), (232, 222, 255)), 'cocreate')                                        # 团队：紫
save(tone(fit(P('pt_research')), (150, 82, 10), (255, 236, 205)), 'triage')                                    # 梳理：琥珀
save(tone(fit(P('pt_admin')), (160, 36, 60), (255, 226, 230), .6), 'awaiting')                                 # 待签方案：玫红
save(tone(fit(P('pt_ops')), (24, 70, 170), (218, 232, 255)), 'planned')                                         # 上升柱状：蓝
save(ImageEnhance.Color(fit(P('wc_lake'), (0, 40, 300, 360))).enhance(1.1), 'finished')                          # 登顶日出：原色
save(tone(fit(P('pt_content')), (40, 60, 90), (232, 238, 246), .55, 1), 'draft')
save(tone(fit(P('pt_event')), (60, 66, 80), (236, 238, 242), .55, 1), 'closed')
