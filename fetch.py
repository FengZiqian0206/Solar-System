"""Download the JPL source once, preserving its response-body bytes."""

from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
SOURCE_URL = "https://ssd.jpl.nasa.gov/planets/phys_par.html"
RAW = ROOT / "data" / "jpl-planetary-physical-parameters.html"


def main():
    if RAW.exists():
        print(f"Using existing raw file (no download): {RAW}")
        return
    request = Request(SOURCE_URL, headers={"User-Agent": "Solar-System-course-project/1.0"})
    with urlopen(request, timeout=60) as response:
        content = response.read()
        metadata = {
            "source_url": SOURCE_URL,
            "resolved_url": response.geturl(),
            "retrieved_at_utc": datetime.now(timezone.utc).isoformat(),
            "content_type": response.headers.get("Content-Type"),
            "bytes": len(content),
            "sha256": hashlib.sha256(content).hexdigest(),
        }
    if b"Planetary Physical Parameters" not in content or b"Neptune" not in content:
        raise ValueError("The response is not the expected JPL data page; nothing was saved.")
    RAW.parent.mkdir(parents=True, exist_ok=True)
    # Exclusive creation prevents an existing research snapshot from being overwritten.
    with RAW.open("xb") as target:
        target.write(content)
    (RAW.parent / "source.json").write_text(
        json.dumps(metadata, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Saved {len(content):,} unchanged bytes: {RAW}")
    print(f"SHA-256: {metadata['sha256']}")


if __name__ == "__main__":
    main()
