import json
import time
import re

from mpi4py import MPI
import os
import sys

from argparser import args
from utils import generate_item, return_words_ngrams, normalise_location

start_time = time.time()

# Initialize MPI
comm = MPI.COMM_WORLD
rank = comm.Get_rank()
size = comm.Get_size()

# Output file name based on rank
DATA_FILE = f'twitter_cleaned_{rank}.json'

# Create empty list in JSON file
with open(DATA_FILE, 'w', encoding='utf-8') as f:
    f.write('[\n')

# Load SAL data
with open(args.sal_path) as json_file:
    sal_dict = json.load(json_file)

# Lists for storing parsed data
twid_lst = []
author_lst = []
created_time_lst = []
text_content_lst = []
location_lst = []
gcc_lst = []

# Define patterns
id_pattern = re.compile(r'"_id":\s*"([^"]+)"')
author_pattern = re.compile(r'"author_id":\s*"([^"]+)"')
created_time_pattern = re.compile(r'"created_at":\s*"([^"]+)"')
text_pattern = re.compile(r'"text":\s*"([^"]+)"')
location_pattern = re.compile(r'"full_name":\s*"([^"]+)"')

# Open the file
with open(args.twitter_file_path, 'rb') as f:
    # Seek for the corresponding chunk for the core to read
    file_size = f.seek(0, 2)
    chunk_size = file_size // size
    start = rank * chunk_size
    end = (rank + 1) * chunk_size
    f.seek(start)

    # Read the file
    finish_read = False
    one_more_item = True
    twid = None
    author = None
    created_time = None
    text_content = None
    location = None
    gcc = None

    while not finish_read:
        curr_line = f.readline().decode()

        # End of file reached
        if not curr_line:
            if (twid and author and created_time and text_content) and (not location):
                # no position information for current item
                # record the current item
                # location_lst.append('')
                # gcc_lst.append('')
                location = ''
                gcc = ''

                # Append the new message to the JSON file
                item = generate_item(twid.group(1), author.group(1), 
                                     created_time.group(1), text_content.group(1), 
                                     location, gcc)

                with open(DATA_FILE, 'a', encoding='utf-8') as output_f:
                    # Append the new message to the JSON file
                    json.dump(item, output_f, indent=2, sort_keys=True, default=str)
                    output_f.write(',\n')
            break

        # Match tweet id
        if not twid:
            twid = id_pattern.search(curr_line)
            continue

        # Match corresponding author
        if twid and (not author):
            author = author_pattern.search(curr_line)
            continue

        # Match corresponding created_time
        if (twid and author) and (not created_time):
            created_time = created_time_pattern.search(curr_line)
            continue

        # Match corresponding text_content
        if (twid and author and created_time) and (not text_content):
            text_content = text_pattern.search(curr_line)
            continue

        # Match corresponding location
        if (twid and author and created_time and text_content) and (not location):
            location = location_pattern.search(curr_line)
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
                item = generate_item(twid.group(1), author.group(1), 
                                     created_time.group(1), text_content.group(1), 
                                     location.group(1), gcc)

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

                if f.tell() >= end:
                    finish_read = True
                    break
                else:
                    continue


            if re.search(r'"_id":\s*"([^"]+)"', curr_line):
                # no position information for current item
                # record the current item
                location = ''
                gcc = ''

                # Append the new message to the JSON file
                item = generate_item(twid.group(1), author.group(1), 
                                     created_time.group(1), text_content.group(1), 
                                     location, gcc)

                with open(DATA_FILE, 'a', encoding='utf-8') as output_f:
                    # Append the new message to the JSON file
                    json.dump(item, output_f, indent=2, sort_keys=True, default=str)
                    output_f.write(',\n')

                # reset and head to the next item
                if f.tell() >= end:
                    if one_more_item:
                        # one more item to read
                        twid = re.search(r'"_id":\s*"([^"]+)"', curr_line)
                        author = None
                        created_time = None
                        text_content = None
                        location = None
                        gcc = None

                        one_more_item = False
                        continue
                    else:
                        finish_read = True
                        break

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