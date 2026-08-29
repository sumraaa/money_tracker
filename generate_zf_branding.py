import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

def draw_zf_logo(size=1024, is_splash=False):
    # Dark background #09090B
    img = Image.new('RGBA', (size, size), (9, 9, 11, 255))
    draw = ImageDraw.Draw(img)

    center = size // 2
    radius = int(size * 0.36)

    # Draw rounded squircle / subtle glow background container
    squircle_margin = int(size * 0.12)
    squircle_rect = [squircle_margin, squircle_margin, size - squircle_margin, size - squircle_margin]
    corner_radius = int(size * 0.22)

    # Draw elevated card background #111113
    draw.rounded_rectangle(squircle_rect, radius=corner_radius, fill=(17, 17, 19, 255), outline=(129, 140, 248, 60), width=int(size * 0.008))

    # Inner geometric ZF emblem lines
    # Z line coordinates
    stroke_w = int(size * 0.055)
    
    # Indigo gradient color #818CF8 -> #6366F1
    indigo_light = (129, 140, 248, 255)
    indigo_core = (99, 102, 241, 255)
    accent_emerald = (52, 211, 153, 255)

    # Drawing Z & F interlocking geometric polygon paths
    # Top bar of Z
    top_z_y = center - int(size * 0.18)
    bot_z_y = center + int(size * 0.18)
    left_x = center - int(size * 0.18)
    right_x = center + int(size * 0.18)
    mid_x = center + int(size * 0.02)

    # Top Z bar
    draw.line([(left_x, top_z_y), (right_x, top_z_y)], fill=indigo_light, width=stroke_w)
    # Diagonal Z bar
    draw.line([(right_x, top_z_y), (left_x, bot_z_y)], fill=indigo_core, width=stroke_w)
    # Bottom Z bar
    draw.line([(left_x, bot_z_y), (right_x, bot_z_y)], fill=indigo_core, width=stroke_w)

    # F accent crossbar
    f_bar_y = top_z_y + int(size * 0.12)
    draw.line([(mid_x - int(size * 0.08), f_bar_y), (right_x - int(size * 0.04), f_bar_y)], fill=accent_emerald, width=int(stroke_w * 0.8))

    # Subtle glowing dots at corners
    dot_r = int(size * 0.02)
    draw.ellipse([right_x - dot_r, top_z_y - dot_r, right_x + dot_r, top_z_y + dot_r], fill=indigo_light)
    draw.ellipse([left_x - dot_r, bot_z_y - dot_r, left_x + dot_r, bot_z_y + dot_r], fill=accent_emerald)

    return img

def create_splash_screen(width=1242, height=2436):
    img = Image.new('RGBA', (width, height), (9, 9, 11, 255))

    # Render central logo
    logo_size = 512
    logo = draw_zf_logo(size=logo_size, is_splash=True)

    # Paste logo at center
    logo_x = (width - logo_size) // 2
    logo_y = (height - logo_size) // 2 - 100
    img.paste(logo, (logo_x, logo_y), logo)

    draw = ImageDraw.Draw(img)
    
    # Text fallback / subtle branding
    # Draw minimalist ZF text subtitle line
    text_y = logo_y + logo_size + 60
    bar_w = 120
    bar_h = 4
    draw.rounded_rectangle([(width - bar_w) // 2, text_y, (width + bar_w) // 2, text_y + bar_h], radius=2, fill=(129, 140, 248, 200))

    return img

if __name__ == '__main__':
    os.makedirs('assets', exist_ok=True)
    
    icon = draw_zf_logo(1024)
    icon.save('assets/icon.png')
    print("Generated assets/icon.png (1024x1024)")

    adaptive = draw_zf_logo(1024)
    adaptive.save('assets/adaptive-icon.png')
    print("Generated assets/adaptive-icon.png (1024x1024)")

    splash = create_splash_screen(1242, 2436)
    splash.save('assets/splash.png')
    print("Generated assets/splash.png (1242x2436)")

    fav = draw_zf_logo(192)
    fav.save('assets/favicon.png')
    print("Generated assets/favicon.png (192x192)")

    print("All ZF Minimalist Branding assets generated successfully!")
