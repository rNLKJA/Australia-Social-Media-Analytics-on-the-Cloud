# Twitter Data Processing & Mastodon Havestor API


## Huge Twitter Data Processing

Huge Twitter data is provided by Unimelb and available in [Dropbox](https://www.dropbox.com/s/r6l4ke6h858bzph/twitter-huge.json.zip?dl=0). The processing logic similar to [2023 CCC Assignment 1](https://github.com/rNLKJA/Unimelb-Master-2023-COMP90024-Assignment-1) big twitter file processing logic.

1. Initiat MPI with given file chunk size
2. Processing the twitter data by readline, each line contains a single tweet information
3. Upload tweet which has a valid tweet_id, author_id and content to CouchDB database, content must be normalised
4. Continue until end of the file or specified chunk size

> To save the output file, alter db to `None` and uncomment line `output_f.write(tweet.to_json(rank) + '\n')` in `twitter.processor`.

To run code, make sure `twitter_huge.json` is under `data` folder. Before running the code, you need to create a `.env` file to store environment variables such as CouchDB connection url, username and password, etc.

```bash
# example code
cd 4_Python_data_processing
mpiexec -n [NUM_OF_PROCESSOR] python3 scripts/bigTwitterProcessingV1.py -t twitter_huge
```

## Mastodon Havestor API

Mastodon APIs were wrapped in `notebooks` folder. You could also access utility scripts under `scripts` folder.

The general use case of Mastodon API is to fetch data from a target Mastodon server based on provided access token and api connection url.

To stream processing fetched data to data base, you need to initialise the CouchDB API. Using the connection string you could easily complete any CRUD operations.
