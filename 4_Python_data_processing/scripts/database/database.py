import couchdb
import dotenv
import os

dotenv.load_dotenv()

COUCHDB_HOST = os.environ['COUCHDB_HOST']
COUCHDB_PORT = os.environ['COUCHDB_PORT']
COUCHDB_USERNAME = os.environ['COUCHDB_USERNAME']
COUCHDB_PASSWORD = os.environ['COUCHDB_PASSWORD']

instance_url = f"http://{COUCHDB_USERNAME}:{COUCHDB_PASSWORD}@{COUCHDB_HOST}:{COUCHDB_PORT}"
server = couchdb.Server(instance_url)

db_name = 'twitter'
# create a twitter database if not exist
if db_name in server:
    db = server[db_name]
    print(f"Database '{db_name}' already exists")
else:
    db = server.create(db_name)
    print(f"Database '{db_name}' created")

def upload_document(data: dict, db: couchdb.client.Database=db):
    """
    Args:
        data (dict): dictionary like object
        db (couchdb.client.Database): target CouchDB database
    Return:
        _id: documentation id
        rev: revision id
    """
    doc_id, doc_rev = db.save(data)
    print(f"Document uploaded with ID: {doc_id}", end='\r')
        
