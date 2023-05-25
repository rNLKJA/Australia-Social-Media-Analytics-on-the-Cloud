#!/usr/bin/env bash

ansible-galaxy collection install openstack.cloud
. ~/openrc.sh; ansible-playbook -i inventory/inventory.ini playbooks/run-couchdb-cluster.yaml
