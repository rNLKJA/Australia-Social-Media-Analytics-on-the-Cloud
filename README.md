<h1 align=center>2023 S1 Cluster and Cloud Computing<br>Australia Social Media Analytics on the Cloud</h1>

The project focuses on an export of Twitter data
from the Australian Data Observatory [ADO](www.ado.eresearch.unimelb.edu.au) , data to be
harvested by students from the Mastodon APIs and data from the Spatial Urban Data Observatory
[SUDO](https://sudo.eresearch.unimelb.edu.au). The focus of this assignment is to use a large Twitter
corpus (that will be provided) to tell interesting stories of life in Australian and importantly how
social media data can be used alongside/compared with/augment the official data available within
the SUDO platform to improve our knowledge of life in Australia.

## Team 57

| Name              | Student ID | Email                                    |
| :---------------- | :--------: | :--------------------------------------- |
| Zongchao Xie      | 1174047    | zongchao.xie@student.unimelb.edu.au      |
| Xuan Wang         | 1329456    | xuan.wang19@student.unimelb.edu.au       |
| Runqiu Fei        | 1166093    | runqiu.fei@student.unimelb.edu.au        |
| Wei Zhao          | 1118649    | zhao.w2@student.unimelb.edu.au           |
| Sunchuangyu Huang | 1118472    | sunchuangy.huangh@student.unimelb.edu.au |


## Directories

```
team-57-ccc-assignment-2/
│
├── .gitignore
├── README.md
├── LICENSE
│
├── frontend/
│   ├── public/
│   ├── src/
│   ├── package.json
│   └── ...
│   └── README.md
│
├── backend/
│   ├── flask-backend/
│   │   ├── app.py
│   │   └── ...
│   └── requirements.txt
│
├── database/
│   ├── couchdb/
│   │   ├── design_docs/
│   │   ├── scripts/
│   │   └── config.json
│   └── README.md
│
├── data_processing/
│   ├── scripts/
│   ├── input/
│   ├── output/
│   └── requirements.txt
│   └── README.md
│
└── server_deployment/
    ├── ansible/
    │   ├── inventory/
    │   ├── roles/
    │   ├── playbooks/
    │   └── ansible.cfg
    ├── docker/
    │   ├── frontend/
    │   │   └── Dockerfile
    │   ├── backend/
    │   │   └── Dockerfile
    │   ├── database/
    │   │   └── Dockerfile
    │   └── docker-compose.yml
    └── README.md
```

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
ansible-playbook -i inventory.ini /playbook/deploy_flask.yml --private-key /Users/weizhao1/cloud_backend.key

```
## Dependencies

## License

The code will be public after 27th May 2023. For @copyright information please refer to MIT License.

---
<p alignright>Team 57</p>
