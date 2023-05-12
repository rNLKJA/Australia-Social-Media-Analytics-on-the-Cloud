import couchdb
import dotenv
import os

dotenv.load_dotenv()

COUCHDB_HOST = os.environ['COUCHDB_HOST']
COUCHDB_PORT = os.environ['COUCHDB_PORT']
COUCHDB_USERNAME = os.environ['COUCHDB_USERNAME']
COUCHDB_PASSWORD = os.environ['COUCHDB_PASSWORD']

class CouchDB:
    def __init__(self, host=COUCHDB_HOST, port=COUCHDB_PORT, 
                 username=COUCHDB_USERNAME, password=COUCHDB_PASSWORD):
        self.host = host,
        self.port = port,
        self.username = username
        self.password = password

        self.instance_url = f"http://{self.username}:{self.password}@{self.host}:{self.port}"
        self.server = "Server Disconnected"
    
    def connect(self):
        self.server = couchdb.Server(self.instance_url)
        print(self.server)
        
    def __repr__(self):
        return f"{self.server}"
        
    def connect(self):
        self.server = couchdb.Server(self.instance_url)
        print(self.server)
        
    def upload_document(self, db, data, verbose=False):
        doc_id, doc_rev = db.save(data)
        if verbose:
            print(f"Document uploaded with ID: {doc_id}", end='\r')
    
    def create_database(self, dbname):
        try:
            db = self.server.create(dbname)
            print(f"Database '{dbname}' created successfully.")
            return db
        except couchdb.http.PreconditionFailed:
            print(f"Database '{dbname}' already exists.")
            return self.server[dbname]

    def get_document(self, db, doc_id):
        try:
            doc = db[doc_id]
            return doc
        except couchdb.http.ResourceNotFound:
            print(f"Document with ID '{doc_id}' not found.")
            return None
    
    def delete_document(self, db, doc_id):
        try:
            doc = db[doc_id]
            db.delete(doc)
            print(f"Document with ID '{doc_id}' deleted successfully.")
        except couchdb.http.ResourceNotFound:
            print(f"Document with ID '{doc_id}' not found.")
    
    def update_document(self, db, doc_id, updated_data):
        doc = self.get_document(db, doc_id)
        if doc:
            doc.update(updated_data)
            db.save(doc)
            print(f"Document with ID '{doc_id}' updated successfully.")
        else:
            print(f"Document with ID '{doc_id}' not found.")

    def list_databases(self):
        return self.server.all_dbs()

    def list_documents(self, db):
        return [doc for doc in db.view("_all_docs")]



