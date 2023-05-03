# Team 57 - Ansible Deployment


## How to install ansible

MACOS

```bash

brew install ansible

##or

pip install ansible

```


WSL

```bash
sudo apt-get update && sudo apt-get install software-properties-common
sudo apt-add-repository --yes --update ppa:ansible/ansible
sudo apt-get install ansible

```
## How to deploy the application using ansible playbook.

```bash

## replace the private-key to your local path
ansible-playbook -i server_deployment/ansible/inventory/inventory.ini server_deployment/ansible/playbook/deploy_flask.yml --private-key /Users/weizhao1/cloud_backend.key

```