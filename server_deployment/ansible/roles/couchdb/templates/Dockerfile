FROM redpeony159/mycouchdb:1.0

COPY ./vm.args /opt/couchdb/etc/

COPY local.ini /opt/couchdb/etc/local.d/

COPY local.ini /opt/couchdb/etc/

CMD ["sh", "-c", "/opt/couchdb/bin/couchdb -c"]
