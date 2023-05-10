from typing import List
import os

from dotenv import load_dotenv

from argparser import args

import couchdb


# read environments
load_dotenv()

COUCHDB_HOST = os.environ['COUCHDB_HOST']
COUCHDB_PORT = os.environ['COUCHDB_PORT']
COUCHDB_USERNAME = os.environ['COUCHDB_USERNAME']
COUCHDB_PASSWORD = os.environ['COUCHDB_PASSWORd']

CONNECTION_URL = f"http://{COUCHDB_USERNAME}:{COUCHDB_PASSWORD}@{COUCHDB_HOST}:{COUCHDB_PORT}"
DATABASE = args.database

# build connection with database
server = couchdb.Server(CONNECTION_URL)

if DATABASE in server:
    db = server[DATABASE]
    print(f"Database {DATABASE} already exists")
else:
    db = server.create(DATABASE)
    print(f"Database {DATABASE} created")
    db = server[DATABASE]

def upload_document(data: dict, db: couchdb.client.Database=db):
    """
    Args:
        data (dict): dictionary like object
        db (couchdb.client.Database): target CouchDB database
    Return:
        _id: documentation id
        rev: revision id
    """
    try:
        doc_id, doc_rev = db.save(data)
        print(f"Document uploaded with ID: {doc_id}", end='\r')
    except couchdb.http.ResourceConflict:
        # If the document already exists, update it with the latest data
        doc_id = data['_id']
        doc_rev = db[doc_id]['_rev']
        data['_rev'] = doc_rev
        db.save(data)
        print(f"Document updated with ID: {doc_id}", end='\r')