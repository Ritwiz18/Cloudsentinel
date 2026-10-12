import argparse
import json
import sys
import urllib.error
import urllib.request
from typing import List, Dict, Any

from simulator.generator import generate_scenario_events, generate_all_events


def send_event(target_url: str, event_data: Dict[str, Any]) -> int:
    payload = json.dumps(event_data).encode("utf-8")
    req = urllib.request.Request(
        target_url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception as e:
        print(f"[ERROR] Failed to reach {target_url}: {e}", file=sys.stderr)
        return -1


def main():
    parser = argparse.ArgumentParser(description="CloudSentinel Synthetic Event Generator & Dispatcher")
    parser.add_argument(
        "--scenario",
        choices=["all", "auth", "iam", "storage", "benign"],
        default="all",
        help="Scenario to generate (default: all)",
    )
    parser.add_argument(
        "--target",
        default="http://127.0.0.1:8000/api/v1/events",
        help="Target CloudSentinel ingestion URL",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print synthetic events without sending HTTP requests",
    )
    args = parser.parse_args()

    if args.scenario == "all":
        events: List[Dict[str, Any]] = generate_all_events()
    else:
        events = generate_scenario_events(args.scenario)

    print(f"[*] Generated {len(events)} synthetic events for scenario '{args.scenario}'")

    if args.dry_run:
        print(json.dumps(events, indent=2))
        return

    success_count = 0
    duplicate_count = 0
    error_count = 0

    for evt in events:
        status_code = send_event(args.target, evt)
        if status_code == 201:
            success_count += 1
            print(f"[+] Ingested event {evt['event_id']} ({evt['event_type']} - {evt['outcome']}) -> HTTP 201")
        elif status_code == 409:
            duplicate_count += 1
            print(f"[!] Duplicate event {evt['event_id']} -> HTTP 409 Conflict")
        else:
            error_count += 1
            print(f"[-] Failed event {evt['event_id']} -> HTTP {status_code}")

    print(f"\n[DONE] Ingestion Summary: {success_count} Accepted (201), {duplicate_count} Duplicates (409), {error_count} Errors")


if __name__ == "__main__":
    main()
