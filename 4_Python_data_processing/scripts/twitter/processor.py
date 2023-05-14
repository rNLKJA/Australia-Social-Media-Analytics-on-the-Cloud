import re
import json
from pathlib import Path

from .utils import Tweet, normalise_location, return_words_ngrams
from tqdm import tqdm

tweet_id = re.compile(r'"id":"(\d+)"')
author = re.compile(r'"author_id":"(\d+)"')
date = re.compile(r'"created_at":"(.*?)"')
location = re.compile(r'"full_name":"(.*?)"')
text = re.compile(r'"text":"(.*?)"')
label = re.compile(r'"tags":"(.*?)"')

NONE = None

def get_partition(rank, size, num_partitions=4):
    partition_size = size // 4
    if partition_size == 0:
        return 0

    partition_target = int(rank // partition_size)
    if partition_target == num_partitions:
        partition_target -= 1
    return partition_target


COUNT = 1000

def twitter_processor(file, cs, ce, sal_dict, 
                      rank, size, db,
                      ns, sa, li):

    partition = get_partition(rank, size)
    with open(Path().absolute()/'data'/'processed'/f"{partition}.json", 'a') as output_f:

        with open(file, mode='rb') as f:
            f.seek(cs)

            tweet_counter = 0
            tweet_batch = []

            # Create a custom progress bar
            progress_bar = tqdm(desc=f"{rank}: Processing tweets", unit="tweets", dynamic_ncols=True)

            while f.tell() < ce:
                line = f.readline().decode()

                _id = tweet_id.search(line)

                if not _id:    # if no _id found, continue
                    continue   # this (ideal) ignore the first line
                if len(_id.group(1)) < 15:
                    continue

                author_id = author.search(line)
                created_at = date.search(line)
                full_name = location.search(line)
                content = text.search(line)
                tags = label.search(line)

                # remove username and hashtags from content
                # also remove any internal links in content
                if content:
                    content = re.sub(r'@\w+\s*', '', content.group(1))
                    content = re.sub(r'#\w+\s*', '', content)
                    content = re.sub(r'https?:\/\/\S+', '', content)

                    content = ns(content)
                else:
                    continue

                # define the base tweet
                tweet = Tweet(tid=_id.group(1) if _id else NONE,
                            author=author_id.group(1) if author_id else NONE,
                            date=created_at.group(1) if created_at else NONE,
                            lang=li(content),
                            content= content,
                            location=full_name.group(1) if full_name else NONE,
                            tags=tags.group(1) if tags else NONE,
                            score=sa(content))

                # find possible gcc locations
                if full_name:
                    normalised_location = normalise_location(full_name.group(1).lower())

                    if sal_dict.get(normalise_location):
                        tweet.sal = sal_dict.get(normalise_location)

                    ngram_words = return_words_ngrams(normalised_location.split(" "))

                    for possible_location in ngram_words:
                        if sal_dict.get(possible_location):
                            tweet.sal = sal_dict.get(possible_location)
                            break

                if tweet.content and tweet.author and tweet.date:

                    # output_f.write(tweet.to_json(rank) + '\n')

                    # Add tweet to the batch
                    tweet_batch.append(tweet.to_dict(partition))
                    tweet_counter += 1

                    progress_bar.update(1)  # Update the progress bar

                    # If 2500 tweets are in the batch, upload to database
                    if tweet_counter == COUNT:
                        db.upload_bulk_documents(tweet_batch)
                        tweet_counter = 0
                        tweet_batch = []

                        # Reset and restart the progress bar
                        progress_bar.close()
                        progress_bar = tqdm(desc=f"{rank}: Processing tweets", unit="tweets", dynamic_ncols=True)

            # Upload remaining tweets in the batch
            db.upload_bulk_documents(tweet_batch)
            progress_bar.close()
           
def twitter_processor_v1(file, cs, ce, sal_dict, 
                      rank, size, db,
                      ns, sa, li):

    partition = get_partition(rank, size)
    with open(Path().absolute()/'data'/'processed'/f"{partition}.json", 'a') as output_f:

        with open(file, mode='rb') as f:
            f.seek(cs)

            tweet_counter = 0
            tweet_batch = []

            # Create a custom progress bar
            progress_bar = tqdm(desc=f"{rank}: Processing tweets", unit="tweets", dynamic_ncols=True)

            while f.tell() < ce:
                line = f.readline().decode()

                _id = tweet_id.search(line)

                if not _id:    # if no _id found, continue
                    continue   # this (ideal) ignore the first line
                if len(_id.group(1)) < 15:
                    continue

                full_name = location.search(line)
                
                # check location existence, if not exist then continue
                if not full_name:
                    continue
                
                author_id = author.search(line)
                created_at = date.search(line)
                content = text.search(line)
                tags = label.search(line)

                # remove username and hashtags from content
                # also remove any internal links in content
                if content:
                    content = re.sub(r'@\w+\s*', '', content.group(1))
                    content = re.sub(r'#\w+\s*', '', content)
                    content = re.sub(r'https?:\/\/\S+', '', content)

                    content = ns(content)
                else:
                    continue

                # define the base tweet
                tweet = Tweet(tid=_id.group(1) if _id else NONE,
                            author=author_id.group(1) if author_id else NONE,
                            date=created_at.group(1) if created_at else NONE,
                            lang=li(content),
                            content= content,
                            location=full_name.group(1) if full_name else NONE,
                            tags=tags.group(1) if tags else NONE,
                            score=sa(content))

                # find possible gcc locations
                if full_name:
                    normalised_location = normalise_location(full_name.group(1).lower())

                    if sal_dict.get(normalise_location):
                        tweet.sal = sal_dict.get(normalise_location)

                    ngram_words = return_words_ngrams(normalised_location.split(" "))

                    for possible_location in ngram_words:
                        if sal_dict.get(possible_location):
                            tweet.sal = sal_dict.get(possible_location)
                            break

                if tweet.content and tweet.author and tweet.date:

                    # output_f.write(tweet.to_json(rank) + '\n')

                    # Add tweet to the batch
                    tweet_batch.append(tweet.to_dict(partition))
                    tweet_counter += 1

                    progress_bar.update(1)  # Update the progress bar

                    # If 2500 tweets are in the batch, upload to database
                    if tweet_counter == COUNT:
                        db.upload_bulk_documents(tweet_batch)
                        tweet_counter = 0
                        tweet_batch = []

                        # Reset and restart the progress bar
                        progress_bar.close()
                        progress_bar = tqdm(desc=f"{rank}: Processing tweets", unit="tweets", dynamic_ncols=True)

            # Upload remaining tweets in the batch
            db.upload_bulk_documents(tweet_batch)
            progress_bar.close()
