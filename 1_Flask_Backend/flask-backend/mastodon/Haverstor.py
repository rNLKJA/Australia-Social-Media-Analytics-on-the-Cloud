# pylint: disable=import-error

from mastodon import Mastodon
import os
from dotenv import load_dotenv
import pytz
from bs4 import BeautifulSoup
from toot import *
from utils import *
from mastodon_api import *
from database import *
import pandas as pd

load_dotenv()

MASTODON_SERVERS = ["SOCIAL", "AU", "TICTOC_SOCIAL"]
MASTODON_SERVERS = [MastodonData(server) for server in MASTODON_SERVERS]

mastodon_social = create_mastodon_client(MASTODON_SERVERS[0])
mastodon_au = create_mastodon_client(MASTODON_SERVERS[1])
mastodon_tictoc = create_mastodon_client(MASTODON_SERVERS[2])

db_social = CouchDB('mastodon_social')
db_au = CouchDB('mastodon_au')
db_tictoc = CouchDB('mastodon_tictoc')

while True:
    for client, db in zip([mastodon_social, mastodon_au, mastodon_tictoc], [db_social, db_au, db_tictoc]):
        # obtain the latest id in the database
        latest_id = db.get_last_tid()
        response = get_40_response(client, latest_id)

        print(response[-1])
        db.upload_bulk_documents(response, verbose=True)
