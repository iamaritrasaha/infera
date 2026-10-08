"""Privacy-centric logging configuration for Infera."""

import logging
import sys


def setup_logging() -> logging.Logger:
    """Configures structured, privacy-preserving logger.

    Never logs row data or dataset contents.
    """
    logger = logging.getLogger("infera")
    logger.setLevel(logging.INFO)

    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        formatter = logging.Formatter(
            fmt="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)

    return logger


logger = setup_logging()
