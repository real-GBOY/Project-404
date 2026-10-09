"""`python -m admit_worker` - run the worker until interrupted."""

from __future__ import annotations

import logging
import sys

from .config import Config
from .worker import Worker


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    try:
        cfg = Config.from_env()
    except ValueError as exc:
        print(f"admit-worker: {exc}", file=sys.stderr)
        return 2
    worker = Worker(cfg)
    worker.install_signal_handlers()
    worker.run_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
