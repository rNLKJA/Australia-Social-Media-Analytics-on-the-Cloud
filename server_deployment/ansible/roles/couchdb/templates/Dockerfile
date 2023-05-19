FROM ibmcom/couchdb3:3.2.1

COPY ./vm.args /opt/couchdb/etc/

# 将 local.ini 文件复制到容器中的正确位置
COPY local.ini /opt/couchdb/etc/local.d/

COPY local.ini /opt/couchdb/etc/

# 在启动时自动重新加载配置
CMD ["sh", "-c", "/opt/couchdb/bin/couchdb -c"]
