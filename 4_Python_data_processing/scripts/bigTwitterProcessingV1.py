import time
import re
import pickle
from pathlib import Path

from mpi4py import MPI
import os
import sys
from dotenv import load_dotenv

load_dotenv()  # load environment variables

from argparser import args
from utils import generate_item, return_words_ngrams, normalise_location, load_pickle_object
from mpi.utils import split_file_into_chunks
from twitter.processor import twitter_processor

twitter_file_path = Path(f'../data/{args.twitter_file}.json')

# load processed sal.dict file
sal_dict = load_pickle_object(Path('../data/sal.processed.dict.pkl'))

# define MPI tools, subtask ranks and size
comm = MPI.COMM_WORLD
rank, size = comm.Get_rank(), comm.Get_size()

# return a list of specified file bytes each process need to processed
chunk_start, chunk_end = split_file_into_chunks(twitter_file_path, size)

twitter_processor(twitter_file_path, chunk_start[rank], chunk_end[rank], sal_dict)

print(rank, chunk_start, chunk_end)

sys.exit()