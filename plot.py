"""Read the saved JPL table and draw an offline SVG; leave main.jpg untouched."""

from html import escape
from html.parser import HTMLParser
import hashlib
import json
import math
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent
RAW = ROOT / "data" / "jpl-planetary-physical-parameters.html"
OUTPUT = ROOT / "out" / "planetary-data.svg"
NAMES = ("Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune")
COLORS = ("#aeb5c2", "#efc26e", "#64c4e9", "#ed8761", "#e35748", "#e9cc8b", "#84dad6", "#6b94ec")


class Tables(HTMLParser):
    """Extract cells without losing spaces at HTML line breaks."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tables, self.table, self.row, self.cell = [], None, None, None

    def handle_starttag(self, tag, attrs):
        if tag == "table":
            self.table = []
        elif tag == "tr" and self.table is not None:
            self.row = []
        elif tag in ("th", "td") and self.row is not None:
            self.cell = []
        elif tag == "br" and self.cell is not None:
            self.cell.append(" ")

    def handle_data(self, data):
        if self.cell is not None:
            self.cell.append(data)

    def handle_endtag(self, tag):
        if tag in ("th", "td") and self.cell is not None:
            self.row.append(" ".join("".join(self.cell).split()))
            self.cell = None
        elif tag == "tr" and self.row is not None:
            self.table.append(self.row)
            self.row = None
        elif tag == "table" and self.table is not None:
            self.tables.append(self.table)
            self.table = None


def read_planets(html):
    parser = Tables()
    parser.feed(html)
    candidates = [t for t in parser.tables if t and t[0] and t[0][0] == "Planet"]
    if len(candidates) != 1:
        raise ValueError("Expected exactly one planetary table in the JPL snapshot.")
    table = candidates[0]
    radius_index = table[0].index("Mean Radius")
    period_index = table[0].index("Sidereal Orbital Period")
    if table[1][radius_index] != "(km)" or table[1][period_index] != "(y)":
        raise ValueError("Source units changed: expected mean radius in km and period in years.")
    planets = {}
    for row in table[2:]:
        if not row or row[0] not in NAMES:
            raise ValueError(f"Unexpected planetary row: {row!r}")
        name = row[0]
        if name in planets or len(row) != len(table[0]):
            raise ValueError(f"Duplicate or incomplete row: {name}")
        values = []
        for index in (radius_index, period_index):
            # Use the central value, not its uncertainty or reference marker.
            match = re.match(r"^([0-9]+(?:\.[0-9]+)?)(?=\s|$)", row[index])
            if not match or float(match[1]) <= 0:
                raise ValueError(f"Invalid {table[0][index]} for {name}: {row[index]!r}")
            values.append(float(match[1]))
        planets[name] = values
    if set(planets) != set(NAMES):
        raise ValueError(f"Missing planets: {sorted(set(NAMES) - set(planets))}")
    return [(name, *planets[name]) for name in NAMES]


def draw(planets):
    parts = [
        '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900" role="img" aria-labelledby="title desc">',
        '<title id="title">Solar System: planetary size and orbital time</title>',
        '<desc id="desc">Eight planets. Horizontal axis: sidereal orbital period in years. Vertical axis: mean radius in kilometres. Both axes are logarithmic. Exact central values appear below.</desc>',
        '<rect width="1200" height="900" fill="#080a0e"/>',
        '<g font-family="Arial, sans-serif" fill="#f3f3f3">',
    ]

    def text(x, y, value, size=14, color="#b6bcc7", anchor="start"):
        parts.append(f'<text x="{x:.2f}" y="{y:.2f}" font-size="{size}" fill="{color}" text-anchor="{anchor}">{escape(str(value))}</text>')

    def line(x1, y1, x2, y2, color="#222731"):
        parts.append(f'<line x1="{x1:.2f}" y1="{y1:.2f}" x2="{x2:.2f}" y2="{y2:.2f}" stroke="{color}"/>')

    def x(period):
        return 120 + math.log10(period / 0.2) / 3 * 940

    def y(radius):
        return 635 - math.log10(radius / 2000) / math.log10(50) * 480

    text(70, 54, "SOLAR SYSTEM / DATA STUDY 01", 13, "#9da6b5")
    text(70, 104, "Planetary size, orbital time", 34, "#ffffff")
    text(70, 133, "NASA / JPL source snapshot · Eight planets · Logarithmic axes", 14)
    for radius in (2000, 5000, 10000, 20000, 50000, 100000):
        line(120, y(radius), 1060, y(radius))
        text(105, y(radius) + 4, f"{radius:,}", 12, anchor="end")
    for period in (0.2, 1, 10, 100, 200):
        line(x(period), 155, x(period), 635)
        text(x(period), 660, f"{period:g}", 12, anchor="middle")
    text(120, 686, "ORBITAL PERIOD / YEARS", 12)
    parts.append('<text transform="translate(28 405) rotate(-90)" text-anchor="middle" font-size="12" fill="#b6bcc7">MEAN RADIUS / KM</text>')
    offsets = ((15, -12), (-15, 24), (15, -14), (15, 20), (-15, -15), (15, 25), (-15, -18), (-15, 24))
    for (name, radius, period), color, (dx, dy) in zip(planets, COLORS, offsets):
        px, py = x(period), y(radius)
        parts.append(f'<circle class="planet" cx="{px:.2f}" cy="{py:.2f}" r="7" fill="{color}"><title>{escape(name)}: {radius:g} km; {period:g} years</title></circle>')
        text(px + dx, py + dy, name, 15, color, "start" if dx > 0 else "end")
    line(70, 712, 1130, 712, "#434a55")
    text(70, 742, "SOURCE VALUES / MEAN RADIUS (KM) · SIDEREAL ORBITAL PERIOD (YEARS)", 12)
    for i, ((name, radius, period), color) in enumerate(zip(planets, COLORS)):
        left = 70 + i * 133
        text(left, 777, name, 14, color)
        text(left, 803, f"{radius:,.4f}".rstrip("0").rstrip(".") + " km", 12, "#e1e5ec")
        text(left, 826, f"{period:.8f}".rstrip("0").rstrip(".") + " y", 12)
    text(70, 875, "Source: ssd.jpl.nasa.gov/planets/phys_par.html · Central values; uncertainties remain in the raw source.", 12, "#8992a0")
    parts.append("</g></svg>")
    return "\n".join(parts) + "\n"


def main():
    if not RAW.exists():
        raise FileNotFoundError("Raw data missing. Run python fetch.py once first.")
    raw = RAW.read_bytes()
    metadata = json.loads((RAW.parent / "source.json").read_text(encoding="utf-8"))
    if hashlib.sha256(raw).hexdigest() != metadata["sha256"]:
        raise ValueError("Raw snapshot differs from its recorded SHA-256; it may have been edited.")
    html = raw.decode("utf-8")
    planets = read_planets(html)
    svg = draw(planets)
    root = ET.fromstring(svg)
    if len(root.findall('.//{http://www.w3.org/2000/svg}circle')) != 8:
        raise ValueError("The plot must contain all eight planets.")
    if "--check" in sys.argv:
        # Small regression check: units, reference data, and malformed cells.
        assert planets[0] == ("Mercury", 2439.4, 0.2408467)
        for broken in (html.replace("2439.4", "invalid"), html.replace("Neptune", "Unknown")):
            try:
                read_planets(broken)
            except ValueError:
                continue
            raise AssertionError("Malformed input was silently accepted.")
        print("Checks passed: integrity, units, eight planets, SVG and malformed-input rejection.")
        return
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(svg, encoding="utf-8")
    print(f"Plotted all {len(planets)} planets: {OUTPUT}")


if __name__ == "__main__":
    main()
