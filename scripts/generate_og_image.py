"""Generate og-image.png for 604 Kars — matches the racing-green/brass/paper design system."""
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630

PAPER = (243, 238, 227)
INK = (22, 36, 27)
RACING_GREEN = (15, 61, 40)
BRASS = (169, 121, 60)
HAIRLINE = (217, 206, 184)

img = Image.new("RGB", (W, H), RACING_GREEN)
draw = ImageDraw.Draw(img)

# Paper panel inset (editorial card-on-brand feel)
margin = 0
draw.rectangle([0, 0, W, H], fill=RACING_GREEN)

# Brass hairline frame
frame_pad = 36
draw.rectangle(
    [frame_pad, frame_pad, W - frame_pad, H - frame_pad],
    outline=BRASS, width=2
)

georgia_bold = ImageFont.truetype("/System/Library/Fonts/Supplemental/Georgia Bold.ttf", 74)
georgia_italic = ImageFont.truetype("/System/Library/Fonts/Supplemental/Georgia Italic.ttf", 74)
helv_small = ImageFont.truetype("/System/Library/Fonts/HelveticaNeue.ttc", 26)
helv_tiny = ImageFont.truetype("/System/Library/Fonts/HelveticaNeue.ttc", 20)
mono = ImageFont.truetype("/System/Library/Fonts/Supplemental/Courier New Bold.ttf", 18)

# Spec-plate eyebrow (signature element, echoed in the OG card)
plate_text = "VANCOUVER  ·  TURO CO-HOSTING"
plate_y = 130
bbox = draw.textbbox((0, 0), plate_text, font=mono)
plate_w = bbox[2] - bbox[0]
plate_x = 90
pad_x, pad_y = 16, 10
draw.rectangle(
    [plate_x - pad_x, plate_y - pad_y, plate_x + plate_w + pad_x, plate_y + (bbox[3]-bbox[1]) + pad_y],
    outline=BRASS, width=1
)
draw.text((plate_x, plate_y), plate_text, font=mono, fill=BRASS)

# Headline
draw.text((88, 210), "Your car is an", font=georgia_bold, fill=PAPER)
draw.text((88, 300), "idle asset.", font=georgia_italic, fill=(199, 154, 92))

# Subline
sub = "604 Kars manages guest messages, cleaning, and"
sub2 = "pricing for your vehicle on Turo — Vancouver."
draw.text((90, 430), sub, font=helv_small, fill=(230, 226, 214))
draw.text((90, 466), sub2, font=helv_small, fill=(230, 226, 214))

# Footer wordmark
draw.text((90, 540), "604 KARS", font=helv_tiny, fill=BRASS)
draw.text((90, 568), "604kars.com", font=helv_tiny, fill=(200, 196, 184))

img.save("og-image.png", "PNG", optimize=True)
print("saved og-image.png", img.size)
