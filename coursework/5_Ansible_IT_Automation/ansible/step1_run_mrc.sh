#!/usr/bin/env bash

ansible-galaxy collection install openstack.cloud

. ~/openrc.sh; ansible-playbook playbooks/mrc.yaml