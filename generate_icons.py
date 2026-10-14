import os
from PIL import Image, ImageOps, ImageDraw

def main():
    root = os.path.dirname(os.path.abspath(__file__))
    logo_path = os.path.join(root, "logo.jpg")
    
    if not os.path.exists(logo_path):
        print("logo.jpg not found!")
        return

    orig = Image.open(logo_path).convert("RGBA")
    
    # Invert RGB to find bounding box of non-white content
    rgb = orig.convert("RGB")
    inverted = ImageOps.invert(rgb)
    bbox = inverted.getbbox() # (left, top, right, bottom)
    
    # Add a small padding around the logo content if possible
    pad = 4
    left = max(0, bbox[0] - pad)
    top = max(0, bbox[1] - pad)
    right = min(orig.width, bbox[2] + pad)
    bottom = min(orig.height, bbox[3] + pad)
    
    cropped = orig.crop((left, top, right, bottom))
    c_w, c_h = cropped.size
    
    def render_icon(target_w, target_h, scale_ratio=0.88, is_round=False, bg_color=(255, 255, 255, 255), is_foreground=False):
        # Create base canvas
        canvas = Image.new("RGBA", (target_w, target_h), bg_color)
        
        # Determine scale
        max_w = target_w * scale_ratio
        max_h = target_h * scale_ratio
        ratio = min(max_w / c_w, max_h / c_h)
        new_w = max(1, int(c_w * ratio))
        new_h = max(1, int(c_h * ratio))
        
        resized = cropped.resize((new_w, new_h), Image.Resampling.LANCZOS)
        
        # Calculate centering
        pos_x = (target_w - new_w) // 2
        pos_y = (target_h - new_h) // 2
        
        canvas.paste(resized, (pos_x, pos_y), resized)
        
        if is_round:
            mask = Image.new("L", (target_w, target_h), 0)
            draw = ImageDraw.Draw(mask)
            draw.ellipse((0, 0, target_w - 1, target_h - 1), fill=255)
            
            output = Image.new("RGBA", (target_w, target_h), (0, 0, 0, 0))
            output.paste(canvas, (0, 0), mask)
            return output
            
        return canvas

    # 1. Android Mipmap Icons
    # Mipmap densities and sizes
    # ic_launcher: 48, 72, 96, 144, 192
    # ic_launcher_foreground: 108, 162, 216, 324, 432 (safe zone is inner 66%)
    android_res = os.path.join(root, "android", "app", "src", "main", "res")
    
    android_densities = [
        ("mipmap-mdpi", 48, 108),
        ("mipmap-hdpi", 72, 162),
        ("mipmap-xhdpi", 96, 216),
        ("mipmap-xxhdpi", 144, 324),
        ("mipmap-xxxhdpi", 192, 432),
    ]
    
    for folder, icon_size, fg_size in android_densities:
        target_dir = os.path.join(android_res, folder)
        os.makedirs(target_dir, exist_ok=True)
        
        # ic_launcher.png (square with white bg)
        launcher = render_icon(icon_size, icon_size, scale_ratio=0.88, is_round=False, bg_color=(255, 255, 255, 255))
        launcher.save(os.path.join(target_dir, "ic_launcher.png"), "PNG")
        
        # ic_launcher_round.png (round icon)
        launcher_round = render_icon(icon_size, icon_size, scale_ratio=0.88, is_round=True, bg_color=(255, 255, 255, 255))
        launcher_round.save(os.path.join(target_dir, "ic_launcher_round.png"), "PNG")
        
        # ic_launcher_foreground.png (safe zone ~65%, transparent background so background color shows)
        launcher_fg = render_icon(fg_size, fg_size, scale_ratio=0.65, is_round=False, bg_color=(0, 0, 0, 0))
        launcher_fg.save(os.path.join(target_dir, "ic_launcher_foreground.png"), "PNG")
        print(f"Android {folder} icons generated ({icon_size}px, fg {fg_size}px).")

    # 2. PWA & Web Icons in public/
    public_dir = os.path.join(root, "public")
    icons_dir = os.path.join(public_dir, "icons")
    os.makedirs(icons_dir, exist_ok=True)
    
    pwa_sizes = [72, 96, 128, 144, 152, 192, 384, 512]
    for size in pwa_sizes:
        # Standard icon
        pwa_icon = render_icon(size, size, scale_ratio=0.88, bg_color=(255, 255, 255, 255))
        pwa_icon.save(os.path.join(icons_dir, f"icon-{size}x{size}.png"), "PNG")
        
        # Maskable icon (safe area is inner 80%)
        maskable_icon = render_icon(size, size, scale_ratio=0.75, bg_color=(255, 255, 255, 255))
        maskable_icon.save(os.path.join(icons_dir, f"icon-maskable-{size}x{size}.png"), "PNG")

    # Apple Touch Icon (180x180)
    apple_icon = render_icon(180, 180, scale_ratio=0.88, bg_color=(255, 255, 255, 255))
    apple_icon.save(os.path.join(public_dir, "apple-touch-icon.png"), "PNG")

    # Favicon (64x64 and 32x32)
    fav_icon = render_icon(64, 64, scale_ratio=0.92, is_round=True, bg_color=(255, 255, 255, 255))
    fav_icon.save(os.path.join(public_dir, "favicon.png"), "PNG")
    fav_icon.save(os.path.join(public_dir, "favicon.ico"), "ICO")

    # public/logo.png high-res
    logo_png = render_icon(512, 512, scale_ratio=0.90, bg_color=(255, 255, 255, 255))
    logo_png.save(os.path.join(public_dir, "logo.png"), "PNG")

    # 3. Android Splash Screens
    for d in os.listdir(android_res):
        if d.startswith("drawable"):
            splash_path = os.path.join(android_res, d, "splash.png")
            if os.path.exists(splash_path):
                old_img = Image.open(splash_path)
                w, h = old_img.size
                old_img.close()
                # Center logo on white canvas
                # In portrait, scale logo to 40% of width; in landscape, 40% of height
                scale_dim = min(w, h)
                target_logo_size = int(scale_dim * 0.45)
                splash_img = render_icon(w, h, scale_ratio=(target_logo_size / max(c_w, c_h)) * (max(c_w, c_h) / max(w, h)), bg_color=(255, 255, 255, 255))
                splash_img.save(splash_path, "PNG")
                print(f"Android splash updated for {d} ({w}x{h})")

    print("All Android and PWA icons and splash screens generated successfully!")

if __name__ == "__main__":
    main()
