import os
import pickle
import re
import sys
import time
from pathlib import Path

from dotenv import load_dotenv
from mpi4py import MPI

load_dotenv()  # load environment variables

from argparser import args
from database.database import CouchDB
from mpi.utils import split_file_into_chunks
from sentimental_analysis.analyzer import (
    language_identifier,
    normalize_string,
    sentiment_analysis,
)
from twitter.processor import twitter_processor
from utils import (
    generate_item,
    load_pickle_object,
    normalise_location,
    return_words_ngrams,
)

twitter_file_path = Path().absolute() / "data" / f"{args.twitter_file}.json"

# load processed sal.dict file
sal_path = Path().absolute() / "data" / "sal.processed.dict.pkl"
sal_dict = load_pickle_object(sal_path)

# define MPI tools, subtask ranks and size
comm = MPI.COMM_WORLD
rank, size = comm.Get_rank(), comm.Get_size()

# return a list of specified file bytes each process need to processed
chunk_start, chunk_end = split_file_into_chunks(twitter_file_path, size)
db = CouchDB("twitter_clean_10000")

twitter_processor(
    twitter_file_path,
    chunk_start[rank],
    chunk_end[rank],
    sal_dict,
    rank,
    size,
    db,
    normalize_string,
    sentiment_analysis,
    language_identifier,
)

sys.exit()
