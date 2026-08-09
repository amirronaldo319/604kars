"""Generate og-image.png for 604 Kars.

Matches the current inline design system in index.html: racing green /
brass / paper, Fraunces display type (roman + italic), and the "plate"
signature mark used in the nav and footer.
"""

from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630

PAPER = (243, 238, 227)
RACING_GREEN = (15, 61, 40)
BRASS = (169, 121, 60)
BRASS_LIFT = (223, 174, 104)

img = Image.new("RGB", (W, H), RACING_GREEN)
draw = ImageDraw.Draw(img)

frame_pad = 36
draw.rectangle(
    [frame_pad, frame_pad, W - frame_pad, H - frame_pad],
    outline=BRASS,
    width=2,
)

georgia_bold = ImageFont.truetype("/System/Library/Fonts/Supplemental/Georgia Bold.ttf", 70)
georgia_italic = ImageFont.truetype("/System/Library/Fonts/Supplemental/Georgia Italic.ttf", 70)
helv_small = ImageFont.truetype("/System/Library/Fonts/HelveticaNeue.ttc", 26)
helv_tiny = ImageFont.truetype("/System/Library/Fonts/HelveticaNeue.ttc", 20)
mono_bold = ImageFont.truetype("/System/Library/Fonts/Supplemental/Courier New Bold.ttf", 20)

# The "plate" — same signature mark used for the nav brand and footer.
plate_text = "604 KARS"
plate_y = 100
bbox = draw.textbbox((0, 0), plate_text, font=mono_bold)
plate_w = bbox[2] - bbox[0]
plate_h = bbox[3] - bbox[1]
plate_x = 88
pad_x, pad_y = 14, 10
draw.rectangle(
    [plate_x - pad_x, plate_y - pad_y, plate_x + plate_w + pad_x, plate_y + plate_h + pad_y],
    outline=BRASS,
    width=1,
)
draw.text((plate_x, plate_y), plate_text, font=mono_bold, fill=BRASS_LIFT)

# Headline — matches the live hero copy.
draw.text((88, 195), "Your car earns", font=georgia_bold, fill=PAPER)
draw.text((88, 270), "nothing in the", font=georgia_bold, fill=PAPER)
draw.text((88, 345), "driveway.", font=georgia_italic, fill=BRASS_LIFT)

sub1 = "604 Kars runs your vehicle on Turo end to end —"
sub2 = "listing, guests, handoffs, cleaning and claims."
draw.text((90, 470), sub1, font=helv_small, fill=(230, 226, 214))
draw.text((90, 506), sub2, font=helv_small, fill=(230, 226, 214))

draw.text((90, 568), "604kars.com  ·  Metro Vancouver", font=helv_tiny, fill=(200, 196, 184))

img.save("og-image.png", "PNG", optimize=True)
print("saved og-image.png", img.size)
