#!/bin/bash

echo "== Set variables =="
nodes=(172.26.134.248 172.26.133.214 172.26.128.114)
export masternode=`echo ${nodes} | cut -f1 -d' '`
export declare othernodes=`echo ${nodes[@]} | sed s/${masternode}//`

export size="${#nodes[@]}"
export user='group58'
export pass='group58'
export VERSION='3.2.1'
export cookie='a192aeb9904e6590849337933b000c99'

echo "== Add nodes to cluster =="
for node in ${othernodes} 
do
    curl -XPOST "http://${user}:${pass}@${masternode}:5984/_cluster_setup" \
      --header "Content-Type: application/json"\
      --data "{\"action\": \"enable_cluster\", \"bind_address\":\"0.0.0.0\",\
             \"username\": \"${user}\", \"password\":\"${pass}\", \"port\": \"5984\",\
             \"remote_node\": \"${node}\", \"node_count\": \"$(echo ${nodes[@]} | wc -w)\",\
             \"remote_current_user\":\"${user}\", \"remote_current_password\":\"${pass}\"}"
done

for node in ${othernodes}
do
    curl -XPOST "http://${user}:${pass}@${masternode}:5984/_cluster_setup"\
      --header "Content-Type: application/json"\
      --data "{\"action\": \"add_node\", \"host\":\"${node}\",\
             \"port\": \"5984\", \"username\": \"${user}\", \"password\":\"${pass}\"}"
done


for node in ${othernodes}
do
    curl -XPOST "http://${user}:${pass}@${masternode}:5984/_cluster_setup"\
      --header "Content-Type: application/json"\
      --data "{\"action\": \"add_node\", \"host\":\"${node}\",\
             \"port\": \"5984\", \"username\": \"${user}\", \"password\":\"${pass}\"}"
done


echo "== Finish cluster setup =="
curl -XPOST "http://${user}:${pass}@${masternode}:5984/_cluster_setup"\
    --header "Content-Type: application/json" --data "{\"action\": \"finish_cluster\"}"



echo "==Check cluster status =="
for node in "${nodes[@]}"; do  curl -X GET "http://${user}:${pass}@${node}:5984/_membership"; done


echo "== add Photon web admin =="
couch="-H Content-Type:application/json -X PUT http://$user:$pass@${masternode}:5984"; \
curl $couch/photon; curl https://raw.githubusercontent.com/ermouth/couch-photon/master/photon.json | \
curl $couch/photon/_design/photon -d @- ; curl $couch/photon/_security -d '{}' ; \
curl $couch/_node/_local/_config/csp/attachments_enable -d '"false"' ; \
curl $couch/_node/_local/_config/chttpd_auth/same_site -d '"lax"' ; 

echo "== test Photon web admin =="
curl -XPUT "http://${user}:${pass}@${masternode}:5984/twitter"
for node in "${nodes[@]}"; do  curl -X GET "http://${user}:${pass}@${node}:5984/_all_dbs"; done
