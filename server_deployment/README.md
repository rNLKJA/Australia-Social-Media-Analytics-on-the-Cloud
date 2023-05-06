# Team 57 - Ansible Deployment


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

## replace the private-key to your local path
ansible-playbook -i server_deployment/ansible/inventory/inventory.ini server_deployment/ansible/playbook/deploy_flask.yml --private-key /Users/weizhao1/cloud_backend.key

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