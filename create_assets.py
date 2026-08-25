import zlib
import struct
import os

def create_png(width, height, r, g, b, filename):
    png_sig = b'\x89PNG\r\n\x1a\n'
    
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    ihdr_crc = zlib.crc32(b'IHDR' + ihdr_data)
    ihdr_chunk = struct.pack('>I', len(ihdr_data)) + b'IHDR' + ihdr_data + struct.pack('>I', ihdr_crc)
    
    row = b'\x00' + bytes([r, g, b]) * width
    raw_data = row * height
    compressed_data = zlib.compress(raw_data, level=6)
    idat_crc = zlib.crc32(b'IDAT' + compressed_data)
    idat_chunk = struct.pack('>I', len(compressed_data)) + b'IDAT' + compressed_data + struct.pack('>I', idat_crc)
    
    iend_crc = zlib.crc32(b'IEND')
    iend_chunk = struct.pack('>I', 0) + b'IEND' + struct.pack('>I', iend_crc)
    
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    with open(filename, 'wb') as f:
        f.write(png_sig + ihdr_chunk + idat_chunk + iend_chunk)
    print(f"Generated PNG asset: {filename} ({width}x{height})")

if __name__ == '__main__':
    # Dark OLED background (#0B0F19 -> RGB: 11, 15, 25)
    create_png(1024, 1024, 11, 15, 25, 'assets/icon.png')
    create_png(1024, 1024, 11, 15, 25, 'assets/adaptive-icon.png')
    create_png(1242, 2436, 11, 15, 25, 'assets/splash.png')
    create_png(48, 48, 11, 15, 25, 'assets/favicon.png')
    print("All assets successfully generated!")
