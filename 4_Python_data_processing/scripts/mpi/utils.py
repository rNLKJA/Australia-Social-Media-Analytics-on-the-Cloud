from pathlib import Path
from typing import List
import math


def split_file_into_chunks(path: Path, size: int) -> List[List]:
    """
    Split the total file bytes in to a list of [size] bytes,
    which will tell the file reader where to start reading file.
    """
    file_size: int = path.stat().st_size
    step_size: int = file_size // size

    chunk_size: int = math.ceil(file_size / size)
    chunk_start: List[int] = [
        file_start for file_start in range(0, file_size, chunk_size)
    ]

    chunk_end: List[int] = chunk_start[1:]
    chunk_end.append(file_size)

    return chunk_start, chunk_end
