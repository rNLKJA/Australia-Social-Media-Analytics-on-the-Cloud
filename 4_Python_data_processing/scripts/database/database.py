import couchdb
import dotenv
import os

dotenv.load_dotenv()

COUCHDB_HOST = os.environ['COUCHDB_HOST']
COUCHDB_PORT = os.environ['COUCHDB_PORT']
COUCHDB_USERNAME = os.environ['COUCHDB_USERNAME']
COUCHDB_PASSWORD = os.environ['COUCHDB_PASSWORD']

class CouchDB:
    def __init__(self, dbname, host=COUCHDB_HOST, port=COUCHDB_PORT,
                 username=COUCHDB_USERNAME, password=COUCHDB_PASSWORD):
        self.host = host
        self.port = port
        self.username = username
        self.password = password

        self.instance_url = f"http://{self.username}:{self.password}@{self.host}:{self.port}"
        self.server = couchdb.Server(self.instance_url)
        self.db = self.get_or_create_database(dbname)

    def __repr__(self):
        return f"{self.server} - {self.db}"

    def get_or_create_database(self, dbname):
        try:
            db = self.server.create(dbname)
            print(f"Database '{dbname}' created successfully.")
            return db
        except couchdb.http.PreconditionFailed:
            print(f"Database '{dbname}' already exists.")
            return self.server[dbname]

    def upload_document(self, data, verbose=False):
        doc_id = data.get('_id')
        
        # Check if the document with the specified ID exists
        existing_doc = self.get_document(doc_id)
        if existing_doc:
            # Get the current revision of the existing document
            data['_rev'] = existing_doc['_rev']

        # Save the new or updated document
        doc_id, doc_rev = self.db.save(data)
        
        if verbose:
            print(f"Document uploaded with ID: {doc_id}", end='\r')
        
        return doc_id
    
    def upload_bulk_documents(self, data_list, verbose=False):
        # Get the current revision of the existing documents
        # for data in data_list:
        #     doc_id = data.get('_id')
        #     existing_doc = self.get_document(doc_id)
        #     if existing_doc:
        #         data['_rev'] = existing_doc['_rev']
        
        results = self.db.update(data_list)
        if verbose:
            print(f"{len(data_list)} documents uploaded in bulk.")
        return results

    def get_document(self, doc_id):
        try:
            doc = self.db[doc_id]
            return doc
        except couchdb.http.ResourceNotFound:
            print(f"Document with ID '{doc_id}' not found.", end='\n')
            return None

    def delete_document(self, doc_id):
        try:
            doc = self.db[doc_id]
            self.db.delete(doc)
            print(f"Document with ID '{doc_id}' deleted successfully.")
        except couchdb.http.ResourceNotFound:
            print(f"Document with ID '{doc_id}' not found.")

    def update_document(self, doc_id, updated_data):
        doc = self.get_document(doc_id)
        if doc:
            doc.update(updated_data)
            self.db.save(doc)
            print(f"Document with ID '{doc_id}' updated successfully.")
        else:
            print(f"Document with ID '{doc_id}' not found.")

    def list_documents(self):
        return [doc for doc in self.db.view("_all_docs")]