# Team 57 - Ansible Deployment


## [Demo](https://youtu.be/qermcMn7x1M)


## How to install ansible

MACOS

```bash

brew install ansible

## or

pip install ansible

```


WSL

```bash
sudo apt-get update && sudo apt-get install software-properties-common
sudo apt-add-repository --yes --update ppa:ansible/ansible
sudo apt-get install ansible

```
## How to deploy the application using ansible playbook.

*Note*:

You need to replace the ssh key path with your own one to use the ansible playbok at your own machine.

```bash

## go to the ansible directory
cd server_deployment/ansible

## replace the private-key to your local path
ansible-playbook -i inventory/inventory.ini playbooks/deploy_swarm.yaml

```

## How to configure the MRC setting and create the instance on MRC.

- modify the configuration on server_deployment/ansible/host_vars/mrc.yaml

- edit the server_deployment/ansible/run-mrc.sh script with openrc.sh which you could download from MRC dashboard

```bash
ansible-galaxy collection install openstack.cloud


. {{path to openrc.sh}}; ansible-playbook mrc.yaml

```

run the script under ansible directory

```bash
sh run-mrc.sh
```

## The Workflow of the IT automatation in our project.

Our project deploys both frontend and backend applications, and sets up a database cluster, using Ansible, Docker Swarm, and CouchDB.

### Instance creation

We start by using the script in mrc.yaml to create instances based on the configuration information set in hosts_vars/mrc_yaml. This includes the system image used, the instance name, creation of data volumes, and volume mounting.

### Setting up inventory
After creating the instances, we proceed to copy the IP addresses of the created instances from the MRC dashboard and fill them in the inventory/inventory.ini file. We then assign tasks to the instances according to our needs. Run `step1_run_mrc.sh`

### Database deployment and cluster setup

- First, we set the IP address information of the database node in the `inventory/inventory.ini` and fill in the node information in `server_deployment/ansible/roles/couchdb/templates/init_db.sh`. This script is responsible for establishing the cluster.
-  Then, we run `step2_a_create_couchdb.sh` to deploy CouchDB containers on all database nodes using Docker, completing the mapping of data volume mounts. 
-  Finally, we run `step2_b_setup_couchdb_cluster.sh` to set up the cluster.
-  
### Frontend and Backend Deployment
In our project, for example, we set 172.26.130.83 as the Swarm master node and 172.26.128.118 as the swarm worker. - By running the `step3_a_create_docker_swarm.sh` script, we create a Swarm network based on the node information in inventory.ini. 
- After this, we run `step3_b_deploy_swarm_master.sh` to deploy the frontend React app and the backend Flask app into the Swarm network. The docker image that we created and deployed are stored in the `host_vars/docker_image.yaml`

### Docker stack services scale

Run `step4_service_scale.sh`, select the service and input the replicas number.

By integrating Ansible's powerful automation capabilities with Docker Swarm's robust orchestration features, you can achieve seamless automation of deploying, scaling, and managing containerized applications with enhanced efficiency and consistent reproducibility.
