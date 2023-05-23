<h3>CouchDB cluster deploy step by step manual</h3>

1. Setup instances in <a href="https://dashboard.cloud.unimelb.edu.au/project/instances/">MRC</a> with the flavour the project needs, for example in this project we choose 4 instances, each with 1 V-cpucore and 4GB memmory, running Ubuntu Jammy.

2. Since the instances only have 30GB storage by default, our data is  must be saved in the mounting volumes.<br>  
i. Apply volumes we need in MRC with the size we need, and then attach the volumes to each instances.  
ii. Mount volumes to path "/mnt/" and format the volumes, and then create the path we need.  
`sudo fdisk -l`  
`sudo mkfs.ext4 /dev/vdb`    
`sudo mkdir /mnt/couchdb`  
`sudo mount /dev/vdb /mnt/ -t auto`  
check and record the uuid of the volumes.  
`sudo blkid`  
`sudo vim /etc/fstab`  
add a new line at the end of "fstab" file as following  
`/dev/disk/by-uuid/<uuid we got just now> /mnt ext4 defaults 1 2`

3. Give permission so that the docker image can access this path.  
`sudo chmod 777 /mnt`  
`sudo chown -R 1001 /mnt/couchdb`

4. Install docker. <a href="https://docs.docker.com/engine/install/ubuntu/#uninstall-docker-engine">manual</a>
5. Install docker-compose  
   `sudo apt install docker-compose`
6. Edit "docker-compose.yml" file, modify the ip address as the instances ip that we have been allocated.
7. Run docker container ("docker-compose.yml" should inside the path that we run the docker-compose up command)  
`sudo docker-compose up -d`
8. Cluster setup  
i. Change the nodes ip as the instances ip and change the username and password
```shell script
export declare nodes=(172.17.0.4 172.17.0.3 172.17.0.2)
export masternode=`echo ${nodes} | cut -f1 -d' '`
export declare othernodes=`echo ${nodes[@]} | sed s/${masternode}//`
export size=${#nodes[@]}
export user='admin'
export pass='admin'
export VERSION='3.2.1'
export cookie='a192aeb9904e6590849337933b000c99'
```

Set up the CouchDB cluster:
```shell script
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
```

Finish the cluster setup
```shell
curl -XPOST "http://${user}:${pass}@${masternode}:5984/_cluster_setup"\
    --header "Content-Type: application/json" --data "{\"action\": \"finish_cluster\"}"
```
(Ignore the `{"error":"setup_error","reason":"Cluster setup unable to sync admin passwords"}` message.)


Check whether the cluster configuration is correct:
```shell script
for node in "${nodes[@]}"; do  curl -X GET "http://${user}:${pass}@${node}:5984/_membership"; done
```

Addition of the Photon web-admin:
```shell
couch="-H Content-Type:application/json -X PUT http://$user:$pass@172.17.0.2:5984"; \
curl $couch/photon; curl https://raw.githubusercontent.com/ermouth/couch-photon/master/photon.json | \
curl $couch/photon/_design/photon -d @- ; curl $couch/photon/_security -d '{}' ; \
curl $couch/_node/_local/_config/csp/attachments_enable -d '"false"' ; \
curl $couch/_node/_local/_config/chttpd_auth/same_site -d '"lax"' ; 
```

To test Photon, point your browser to: `http://172.17.0.2:5984/photon/_design/photon/index.html`

Adding a database to one node of the cluster makes it to be created on all other nodes as well:
```shell script
curl -XPUT "http://${user}:${pass}@${masternode}:5984/twitter"
for node in "${nodes[@]}"; do  curl -X GET "http://${user}:${pass}@${node}:5984/_all_dbs"; done
```
