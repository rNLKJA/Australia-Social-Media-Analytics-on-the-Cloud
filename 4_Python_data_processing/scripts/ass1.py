import json
from mpi4py import MPI
import re
from collections import Counter
import pandas as pd
import numpy as np
import argparse
import time
import sys
import os
from itertools import combinations

gccs = [
    "Canberra",
    "Sydney",
    "Darwin",
    "Brisbane",
    "Adelaide",
    "Hobart",
    "Melbourne",
    "Perth",
]

state_location = dict(
    zip(
        [
            s.lower()
            for s in [
                "Australian Capital Territory",
                "New South Wales",
                "Northern Territory",
                "Queensland",
                "South Australia",
                "Tasmania",
                "Victoria",
                "Western Australia",
            ]
        ],
        [s.lower() for s in ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"]],
    )
)


def return_words_ngrams(words: list) -> list:
    """
    Return a list contains ngram words
    """
    return [
        " ".join(c) for i in range(1, len(words) + 1) for c in combinations(words, i)
    ]

def normalise_location(location: str) -> str:
    """
    Normalise location where the location string should not
    contains any puntuations also additional white spaces.
    """
    text = re.sub(r"[^\w\s]", "", location)
    text = re.sub(r" - ", "", text)

    if location.split(",")[0] in gccs:
        text = location.split(",")[0].lower()

    for key, value in state_location.items():
        text = re.sub(key, value, text)

    return re.sub(" +", " ", text)


INVALID_LOCATION = [
    "act australia",
    "nsw australia",
    "nt australia",
    "qld Australia",
    "sa australia",
    "tas australia",
    "vic australia",
    "wa australia",
    "australia",
]

start_time = time.time() 

parser = argparse.ArgumentParser(description='ass1_args')
parser.add_argument('twitter_file_path', type=str, help='twitter_file_path')
parser.add_argument('sal_path', type=str, help='sal_path')
args = parser.parse_args()

# Initialize MPI
comm = MPI.COMM_WORLD
rank = comm.Get_rank()
size = comm.Get_size()

DATA_FILE = str('twitter_cleaned_' + str(rank) + '.json')

# start the list if NO harvesting
with open(DATA_FILE, 'w', encoding='utf-8') as f:
    f.write('[\n')

with open(args.sal_path) as json_file:
    sal_dict = json.load(json_file)

# list for task 1,2,3
twid_lst = []
author_lst = []
created_time_lst = []
text_content_lst = []
location_lst = []
gcc_lst = []

# Open the file
with open(args.twitter_file_path, 'rb') as f:
    # seek for the corresponding chuck for the core to read
    file_size = f.seek(0, 2)
    chunk_size = file_size // size
    start = rank * chunk_size
    end = (rank + 1) * chunk_size
    f.seek(start)

    # read the file
    finish_read = False
    twid = None
    author = None
    created_time = None
    text_content = None
    location = None
    gcc = None
    while not finish_read:
        curr_line = f.readline().decode()

        if not curr_line:
            # end of file
            if (twid and author and created_time and text_content) and (not location):
                # no position information for current item
                # record the current item
                # location_lst.append('')
                # gcc_lst.append('')
                location = ''
                gcc = ''

                # Append the new message to the JSON file
                item = {"_id": twid.group(1),
                        "author_id": author.group(1),
                        "created_at": created_time.group(1),
                        "text": text_content.group(1),
                        "location": location,
                        "possible_suburb": gcc}
                with open(DATA_FILE, 'a', encoding='utf-8') as output_f:
                    # Append the new message to the JSON file
                    json.dump(item, output_f, indent=2, sort_keys=True, default=str)
                    output_f.write(',\n')

            break

        # try match tweet id
        if not twid:
            twid = re.search(r'"_id":\s*"([^"]+)"', curr_line)
            # if twid:
            #     # twid_lst.append(twid.group(1))
            #     continue
        
        # try match corresponding author
        if twid and (not author):
            author = re.search(r'"author_id":\s*"([^"]+)"', curr_line)
            # if author:
            #     # author_lst.append(author.group(1))
            #     continue

        # try match corresponding created_time
        if (twid and author) and (not created_time):
            created_time = re.search(r'"created_at":\s*"([^"]+)"', curr_line)
            # if created_time:
            #     # created_time_lst.append(created_time.group(1))

        # try match corresponding text_content
        if (twid and author and created_time) and (not text_content):
            text_content = re.search(r'"text":\s*"([^"]+)"', curr_line)
            # if text_content:
            #     # text_content_lst.append(text_content.group(1))

        # try match corresponding location
        if (twid and author and created_time and text_content) and (not location):
            location = re.search(r'"full_name":\s*"([^"]+)"', curr_line)
            if location:
                # location_lst.append(location.group(1))
                normalised_location = normalise_location(location.group(1).lower())
                ngram_words = return_words_ngrams(normalised_location.split(" "))

                for possible_location in ngram_words:
                    if sal_dict.get(possible_location):
                        gcc = {possible_location: sal_dict.get(possible_location)}
                        # gcc_lst.append(gcc)
                        break
                
                if not gcc:
                    gcc = ''
                    # gcc_lst.append('')
                
                # Append the new message to the JSON file
                item = {"_id": twid.group(1),
                        "author_id": author.group(1),
                        "created_at": created_time.group(1),
                        "text": text_content.group(1),
                        "location": location.group(1),
                        "possible_suburb": gcc}
                with open(DATA_FILE, 'a', encoding='utf-8') as output_f:
                    # Append the new message to the JSON file
                    json.dump(item, output_f, indent=2, sort_keys=True, default=str)
                    output_f.write(',\n')

                # reset and head to the next item
                twid = None
                author = None
                created_time = None
                text_content = None
                location = None
                gcc = None
                continue

            if re.search(r'"_id":\s*"([^"]+)"', curr_line):
                # no position information for current item
                # record the current item
                # location_lst.append('')
                # gcc_lst.append('')
                location = ''
                gcc = ''

                # Append the new message to the JSON file
                item = {"_id": twid.group(1),
                        "author_id": author.group(1),
                        "created_at": created_time.group(1),
                        "text": text_content.group(1),
                        "location": location,
                        "possible_suburb": gcc}
                with open(DATA_FILE, 'a', encoding='utf-8') as output_f:
                    # Append the new message to the JSON file
                    json.dump(item, output_f, indent=2, sort_keys=True, default=str)
                    output_f.write(',\n')

                # reset and head to the next item
                twid = None
                author = None
                created_time = None
                text_content = None
                location = None
                gcc = None
                continue



        if f.tell() >= end and not (twid or author or created_time or text_content or location):
            # only stop when the current item is complete
            finish_read = True
            break

# replace the last ",\n" with "\n]" to end the list
with open(DATA_FILE, 'rb+') as f:
  f.seek(-3, os.SEEK_END)
  f.truncate()

with open(DATA_FILE, 'a') as f:
  f.write('\n]')

read_end_time = time.time()
print(f"Read time: {read_end_time - start_time} seconds at core {rank}")

sys.exit()