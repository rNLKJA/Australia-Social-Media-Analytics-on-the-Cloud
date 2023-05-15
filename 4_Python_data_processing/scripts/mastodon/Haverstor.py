# pylint: disable=import-error

from mastodon import Mastodon
import os
from dotenv import load_dotenv
import pytz
from bs4 import BeautifulSoup
from mastodon.toot import *
from utils import *
from mastodon.mastodon import *
from database import *

load_dotenv()

MASTODON_SERVER = ["SOCIAL", "AU", "TICTOC_SOCIAL"]
MASTODON_SERVERS = [MastodonData(server) for server in MASTODON_SERVERS]

mastodon_social = create_mastodon_client(MASTODON_SERVERS[0])
mastodon_au =  = create_mastodon_client(MASTODON_SERVERS[1])
mastodon_tictoc =  = create_mastodon_client(MASTODON_SERVERS[2])

db_social = CouchDB('mastodon_social')
db_au = CouchDB('mastodon_au')
db_tictoc = CouchDB('mastodon_tictoc')

for client, db in zip([mastodon_social, mastodon_au, mastodon_tictok], [db_social, db_au, db_tictok]):
    # obtain the latest id in the database
    latest_id = db.get_last_document()
    
    response = get_40_response(client)
    # upload the result
    for res in response:
        db.upload_document(res)
