"""Cleveland adapter: fetch a record by accession number and store it raw, with its retrieved date."""

import datetime
import json
import sys
import urllib.request
from pathlib import Path

API = "https://openaccess-api.clevelandart.org/api/artworks/"


def fetch_snapshot(accession: str) -> dict:
    request = urllib.request.Request(
        f"{API}?accession_number={accession}", headers={"User-Agent": "Mozilla/5.0 provenance-palantir"}
    )
    data = json.load(urllib.request.urlopen(request))["data"]
    if len(data) != 1:
        raise ValueError(f"{accession}: expected 1 record, got {len(data)}")
    return {
        "source": "cleveland",
        "url": f"{API}{accession}",
        "retrieved_at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "version": data[0].get("updated_at"),
        "payload": data[0],
    }


def ingest(accessions: list[str], out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    for accession in accessions:
        snapshot = fetch_snapshot(accession)
        (out_dir / f"{accession}.json").write_text(
            json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        payload = snapshot["payload"]
        print(accession, payload["share_license_status"], len(payload["provenance"] or []), "steps", payload["title"][:40])


if __name__ == "__main__":
    ingest(sys.argv[2:], Path(sys.argv[1]))
