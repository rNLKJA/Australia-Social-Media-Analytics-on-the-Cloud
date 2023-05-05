'''
Don't forget to install and import the library
'''
#!pip install CouchDB
import couchdb


'''
Connect and create database
'''
#couch = couchdb.Server('http://username:password@172.26.135.245:5984/')
couch = couchdb.Server('http://group58:group58@172.26.135.245:5984/')

# # Create a new database
# db = couch.create('my_database')

# Access an existing database
db = couch['my_database']

# List all databases
databases = couch
print("Databases: ", list(databases))



'''
CRUD
Create, Read, Update, and Delete document
'''
# Create a new document
doc = {'type': 'person', 'name': 'John Doe', 'age': 30}
doc_id, doc_rev = db.save(doc)

# Retrieve a document by ID
retrieved_doc = db[doc_id]
print("Retrieved document: ", retrieved_doc)

# Update a document
retrieved_doc['age'] = 31
db.save(retrieved_doc)

# Delete a document
del db[doc_id]

'''
!!! Drop database
'''
# database_name = 'my_database'
# if database_name in couch:
#     couch.delete(database_name)
#     print(f"Database '{database_name}' deleted.")
# else:
#     print(f"Database '{database_name}' not found.")