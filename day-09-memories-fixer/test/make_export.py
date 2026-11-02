"""Builds a made-up Snapchat "My Data" export for testing Memories Fixer.

Two ZIPs, like a real multi-part export: the history JSON is in the first, most memories in the second.
Memories were "taken" in Lisbon, New York and Tokyo so the time-zone handling can be checked, plus one
with no location, two on the same day, a caption overlay, a video, and a chat image that isn't a memory.
Every file and place is made up.

Run: python3 day-09-memories-fixer/test/make_export.py
"""
import io, json, os, struct, zipfile
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'fixtures')
os.makedirs(OUT, exist_ok=True)


def jpeg(color, label):
    im = Image.new('RGB', (480, 640), color)
    d = ImageDraw.Draw(im)
    d.rectangle([40, 40, 440, 600], outline=(255, 255, 255), width=6)
    d.text((60, 300), label, fill=(255, 255, 255))
    b = io.BytesIO(); im.save(b, 'JPEG', quality=85); return b.getvalue()


def overlay(text):
    im = Image.new('RGBA', (480, 640), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 270, 480, 330], fill=(0, 0, 0, 150))
    d.text((40, 292), text, fill=(255, 255, 255, 255))
    b = io.BytesIO(); im.save(b, 'PNG'); return b.getvalue()


def box(kind, payload):
    return struct.pack('>I', 8 + len(payload)) + kind + payload


def mp4():
    """A tiny but well-formed MP4: ftyp, plus moov with mvhd, a trak with tkhd and mdia/mdhd. Times start at 0."""
    ftyp = box(b'ftyp', b'isom' + struct.pack('>I', 512) + b'isomiso2mp41')
    mvhd = box(b'mvhd', bytes([0, 0, 0, 0]) + struct.pack('>IIII', 0, 0, 1000, 3000) + b'\x00' * 80)
    tkhd = box(b'tkhd', bytes([0, 0, 0, 3]) + struct.pack('>IIII', 0, 0, 1, 0) + struct.pack('>I', 3000) + b'\x00' * 60)
    mdhd = box(b'mdhd', bytes([0, 0, 0, 0]) + struct.pack('>IIII', 0, 0, 1000, 3000) + b'\x00' * 4)
    trak = box(b'trak', tkhd + box(b'mdia', mdhd))
    return ftyp + box(b'moov', mvhd + trak)


history = {'Saved Media': [
    {'Date': '2023-07-14 18:22:05 UTC', 'Media Type': 'Image', 'Location': 'Latitude, Longitude: 38.71667, -9.13333',
     'Download Link': 'https://app.snapchat.com/dmd/memories?uid=x&sid=AAAA1111-2222-3333-4444-555566667777&mid=AAAA1111&ts=1'},
    {'Date': '2023-12-31 23:40:00 UTC', 'Media Type': 'Image', 'Location': 'Latitude, Longitude: 40.71274, -74.00597',
     'Download Link': 'https://app.snapchat.com/dmd/memories?uid=x&sid=BBBB2222-2222-3333-4444-555566667777&mid=BBBB2222&ts=1'},
    {'Date': '2022-04-03 01:15:30 UTC', 'Media Type': 'Video', 'Location': 'Latitude, Longitude: 35.68950, 139.69171',
     'Download Link': 'https://app.snapchat.com/dmd/memories?uid=x&sid=CCCC3333-2222-3333-4444-555566667777&mid=CCCC3333&ts=1'},
    {'Date': '2021-06-12 10:05:00 UTC', 'Media Type': 'Image', 'Location': 'Latitude, Longitude: 0.0, 0.0',
     'Download Link': 'https://app.snapchat.com/dmd/memories?uid=x&sid=DDDD4444-2222-3333-4444-555566667777&mid=DDDD4444&ts=1'},
    {'Date': '2020-08-20 15:00:00 UTC', 'Media Type': 'Image', 'Location': 'Latitude, Longitude: 51.50735, -0.12776', 'Download Link': ''},
    {'Date': '2020-08-20 19:30:00 UTC', 'Media Type': 'Image', 'Location': 'Latitude, Longitude: 51.50735, -0.12776', 'Download Link': ''},
]}

with zipfile.ZipFile(os.path.join(OUT, 'mydata~1730550000000.zip'), 'w', zipfile.ZIP_DEFLATED) as z:
    z.writestr('json/memories_history.json', json.dumps(history, indent=1))
    z.writestr('memories/2023-07-14_AAAA1111-2222-3333-4444-555566667777-main.jpg', jpeg((44, 92, 140), 'Lisbon, sunset'))
    z.writestr('memories/2023-07-14_AAAA1111-2222-3333-4444-555566667777-overlay.png', overlay('Miradouro de Santa Luzia'))
    z.writestr('chat_media/2023-05-01_b~EiASFDKJ.jpeg', jpeg((90, 90, 90), 'chat photo'))

with zipfile.ZipFile(os.path.join(OUT, 'mydata~1730550000000-2.zip'), 'w', zipfile.ZIP_DEFLATED) as z:
    z.writestr('memories/2023-12-31_BBBB2222-2222-3333-4444-555566667777-main.jpg', jpeg((150, 40, 60), 'New York, New Year'))
    z.writestr('memories/2022-04-03_CCCC3333-2222-3333-4444-555566667777-main.mp4', mp4())
    z.writestr('memories/2021-06-12_DDDD4444-2222-3333-4444-555566667777-main.jpg', jpeg((60, 120, 60), 'No location'))
    z.writestr('memories/2020-08-20_EEEE5555-2222-3333-4444-555566667777-main.jpg', jpeg((120, 100, 40), 'London one'))
    z.writestr('memories/2020-08-20_FFFF6666-2222-3333-4444-555566667777-main.jpg', jpeg((40, 100, 120), 'London two'))
print('export written to', OUT)
